package provider

import (
	"context"
	"fmt"
	"math/rand"
	"sync"
	"time"
)

type MockProvider struct {
	mu           sync.Mutex
	accounts     map[string]VirtualAccount
	transactions map[string][]Transaction
}

func NewMockProvider() *MockProvider {
	return &MockProvider{
		accounts:     make(map[string]VirtualAccount),
		transactions: make(map[string][]Transaction),
	}
}


func (m *MockProvider) Provision(ctx context.Context, customer Customer) (VirtualAccount, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if existing, ok := m.accounts[customer.AccountRef]; ok {
		return existing, nil
	}

	va := VirtualAccount{
		AccountRef:        customer.AccountRef,
		AccountHolderID:   customer.AccountRef,
		BVN:               customer.BVN,
		AccountName:       customer.AccountName,
		BankName:          "Mock Bank",
		BankAccountNumber: generateFakeNUBAN(),
		BankAccountName:   customer.AccountName,
		Currency:          "NGN",
		Expired:           false,
		CreatedAt:         time.Now(),
	}

	m.accounts[customer.AccountRef] = va
	return va, nil
}

func (m *MockProvider) Fetch(ctx context.Context, accountRef string) (VirtualAccount, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	va, ok := m.accounts[accountRef]
	if !ok {
		return VirtualAccount{}, fmt.Errorf("mock: account %q not found", accountRef)
	}
	return va, nil
}

func (m *MockProvider) Update(ctx context.Context, accountRef string, updates AccountUpdate) (VirtualAccount, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	va, ok := m.accounts[accountRef]
	if !ok {
		return VirtualAccount{}, fmt.Errorf("mock: account %q not found", accountRef)
	}
	va.AccountName = updates.AccountName
	m.accounts[accountRef] = va
	return va, nil
}

func (m *MockProvider) Expire(ctx context.Context, accountRef string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	va, ok := m.accounts[accountRef]
	if !ok {
		return fmt.Errorf("mock: account %q not found", accountRef)
	}
	va.Expired = true
	m.accounts[accountRef] = va
	return nil
}

func (m *MockProvider) FetchTransactions(ctx context.Context, from, to time.Time) ([]Transaction, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	var all []Transaction
	for _, txns := range m.transactions {
		all = append(all, txns...)
	}
	return all, nil
}


func (m *MockProvider) SeedTransaction(accountRef string, tx Transaction) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.transactions[accountRef] = append(m.transactions[accountRef], tx)
}

func generateFakeNUBAN() string {
	return fmt.Sprintf("%010d", rand.Int63n(10_000_000_000))
}

