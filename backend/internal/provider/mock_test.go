package provider

import (
	"context"
	"testing"
	"time"
)

func TestMockProvider_Provision_NewAccount(t *testing.T) {
	m := NewMockProvider()
	customer := Customer{AccountRef: "ref-001", AccountName: "Alice", BVN: "12345678901"}

	va, err := m.Provision(context.Background(), customer)
	if err != nil {
		t.Fatalf("Provision failed: %v", err)
	}
	if va.AccountRef != customer.AccountRef {
		t.Errorf("want AccountRef %q, got %q", customer.AccountRef, va.AccountRef)
	}
	if va.Currency != "NGN" {
		t.Errorf("want currency NGN, got %q", va.Currency)
	}
	if va.Expired {
		t.Error("newly provisioned account should not be expired")
	}
	if len(va.BankAccountNumber) != 10 {
		t.Errorf("want 10-digit NUBAN, got %q", va.BankAccountNumber)
	}
}

func TestMockProvider_Provision_Idempotent(t *testing.T) {
	m := NewMockProvider()
	customer := Customer{AccountRef: "ref-001", AccountName: "Alice"}

	va1, err := m.Provision(context.Background(), customer)
	if err != nil {
		t.Fatalf("first Provision failed: %v", err)
	}
	va2, err := m.Provision(context.Background(), customer)
	if err != nil {
		t.Fatalf("second Provision failed: %v", err)
	}
	if va1.BankAccountNumber != va2.BankAccountNumber {
		t.Error("second Provision should return the same account, not create a new one")
	}
}

func TestMockProvider_Fetch_Found(t *testing.T) {
	m := NewMockProvider()
	provisioned, _ := m.Provision(context.Background(), Customer{AccountRef: "ref-fetch", AccountName: "Bob"})

	fetched, err := m.Fetch(context.Background(), "ref-fetch")
	if err != nil {
		t.Fatalf("Fetch failed: %v", err)
	}
	if fetched.BankAccountNumber != provisioned.BankAccountNumber {
		t.Error("Fetch returned different account than Provision")
	}
}

func TestMockProvider_Fetch_NotFound(t *testing.T) {
	m := NewMockProvider()
	_, err := m.Fetch(context.Background(), "nonexistent")
	if err == nil {
		t.Error("expected error fetching nonexistent account")
	}
}

func TestMockProvider_Update_Found(t *testing.T) {
	m := NewMockProvider()
	m.Provision(context.Background(), Customer{AccountRef: "ref-upd", AccountName: "Carol"})

	updated, err := m.Update(context.Background(), "ref-upd", AccountUpdate{AccountName: "Carol Updated"})
	if err != nil {
		t.Fatalf("Update failed: %v", err)
	}
	if updated.AccountName != "Carol Updated" {
		t.Errorf("want AccountName %q, got %q", "Carol Updated", updated.AccountName)
	}
}

func TestMockProvider_Update_NotFound(t *testing.T) {
	m := NewMockProvider()
	_, err := m.Update(context.Background(), "nonexistent", AccountUpdate{AccountName: "X"})
	if err == nil {
		t.Error("expected error updating nonexistent account")
	}
}

func TestMockProvider_Expire_Found(t *testing.T) {
	m := NewMockProvider()
	ctx := context.Background()
	m.Provision(ctx, Customer{AccountRef: "ref-exp", AccountName: "Dan"})

	if err := m.Expire(ctx, "ref-exp"); err != nil {
		t.Fatalf("Expire failed: %v", err)
	}
	va, _ := m.Fetch(ctx, "ref-exp")
	if !va.Expired {
		t.Error("account should be marked expired after Expire()")
	}
}

func TestMockProvider_Expire_NotFound(t *testing.T) {
	m := NewMockProvider()
	err := m.Expire(context.Background(), "nonexistent")
	if err == nil {
		t.Error("expected error expiring nonexistent account")
	}
}

func TestMockProvider_FetchTransactions_Empty(t *testing.T) {
	m := NewMockProvider()
	txns, err := m.FetchTransactions(context.Background(), "ref-no-txns")
	if err != nil {
		t.Fatalf("FetchTransactions failed: %v", err)
	}
	if len(txns) != 0 {
		t.Errorf("expected 0 transactions, got %d", len(txns))
	}
}

func TestMockProvider_SeedAndFetchTransactions(t *testing.T) {
	m := NewMockProvider()
	ref := "ref-seed"

	tx1 := Transaction{TransactionRef: "txn-001", AccountRef: ref, Amount: 500.00, Direction: "credit", CreatedAt: time.Now()}
	tx2 := Transaction{TransactionRef: "txn-002", AccountRef: ref, Amount: 200.00, Direction: "credit", CreatedAt: time.Now()}
	m.SeedTransaction(ref, tx1)
	m.SeedTransaction(ref, tx2)

	txns, err := m.FetchTransactions(context.Background(), ref)
	if err != nil {
		t.Fatalf("FetchTransactions failed: %v", err)
	}
	if len(txns) != 2 {
		t.Fatalf("expected 2 transactions, got %d", len(txns))
	}
	if txns[0].TransactionRef != "txn-001" || txns[1].TransactionRef != "txn-002" {
		t.Error("transactions returned in wrong order or with wrong data")
	}
}

func TestMockProvider_SeedTransaction_Isolated(t *testing.T) {
	m := NewMockProvider()
	m.SeedTransaction("ref-A", Transaction{TransactionRef: "txn-A"})

	txns, _ := m.FetchTransactions(context.Background(), "ref-B")
	if len(txns) != 0 {
		t.Error("transactions seeded for ref-A should not appear under ref-B")
	}
}
