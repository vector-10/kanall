package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/shopspring/decimal"
	"github.com/vector-10/kanall/internal/model"
	"github.com/vector-10/kanall/internal/repository"
)

var ErrAccountNotFound = errors.New("account not found")

type StatementService struct {
	store *repository.Store
}

func NewStatementService(store *repository.Store) *StatementService {
	return &StatementService{store: store}
}

type StatementLine struct {
	Entry          model.LedgerEntry `json:"entry"`
	RunningBalance decimal.Decimal   `json:"runningBalance"`
}

type StatementPagination struct {
	Limit      int        `json:"limit"`
	NextCursor *uuid.UUID `json:"nextCursor,omitempty"`
	HasMore    bool       `json:"hasMore"`
}

type Statement struct {
	VirtualAccount *model.VirtualAccount `json:"virtualAccount"`
	Lines          []StatementLine       `json:"lines"`
	OpeningBalance decimal.Decimal       `json:"openingBalance"`
	TotalCredits   decimal.Decimal       `json:"totalCredits"`
	TotalDebits    decimal.Decimal       `json:"totalDebits"`
	ClosingBalance decimal.Decimal       `json:"closingBalance"`
	Pagination     StatementPagination   `json:"pagination"`
}

func (s *StatementService) GetStatement(ctx context.Context, tenantID uuid.UUID, accountRef string, limit int, cursorID *uuid.UUID) (*Statement, error) {
	va, err := s.store.Accounts.GetByAccountRef(ctx, tenantID, accountRef)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrAccountNotFound
		}
		return nil, fmt.Errorf("account lookup failed: %w", err)
	}

	// All-time summary — always accurate regardless of the page being viewed
	totalCredits, totalDebits, err := s.store.Ledger.SumByAccount(ctx, tenantID, va.ID)
	if err != nil {
		return nil, fmt.Errorf("ledger summary failed: %w", err)
	}

	// Balance at the end of the previous page — running balances are computed
	// relative to this so they are correct even on page 2, 3, ...
	openingBalance, err := s.store.Ledger.OpeningBalance(ctx, tenantID, va.ID, cursorID)
	if err != nil {
		return nil, fmt.Errorf("opening balance failed: %w", err)
	}

	// Fetch one extra entry so we can detect whether another page exists
	// without a separate COUNT query
	entries, err := s.store.Ledger.ListByAccountPaginated(ctx, tenantID, va.ID, limit+1, cursorID)
	if err != nil {
		return nil, fmt.Errorf("ledger fetch failed: %w", err)
	}

	hasMore := len(entries) > limit
	if hasMore {
		entries = entries[:limit]
	}

	lines := make([]StatementLine, len(entries))
	balance := openingBalance
	for i, e := range entries {
		if e.Direction == "credit" {
			balance = balance.Add(e.Amount)
		} else {
			balance = balance.Sub(e.Amount)
		}
		lines[i] = StatementLine{Entry: e, RunningBalance: balance}
	}

	var nextCursor *uuid.UUID
	if hasMore && len(entries) > 0 {
		last := entries[len(entries)-1].ID
		nextCursor = &last
	}

	return &Statement{
		VirtualAccount: va,
		Lines:          lines,
		OpeningBalance: openingBalance,
		TotalCredits:   totalCredits,
		TotalDebits:    totalDebits,
		ClosingBalance: totalCredits.Sub(totalDebits),
		Pagination: StatementPagination{
			Limit:      limit,
			NextCursor: nextCursor,
			HasMore:    hasMore,
		},
	}, nil
}
