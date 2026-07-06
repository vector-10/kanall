package service

import "github.com/shopspring/decimal"

var (
	nombaFiveThou  = decimal.NewFromInt(5000)
	nombaFiftyThou = decimal.NewFromInt(50000)
	nombaFee10     = decimal.NewFromInt(10)
	nombaFee25     = decimal.NewFromInt(25)
	nombaFee50     = decimal.NewFromInt(50)
)

// NombaFee returns the CBN NIP inbound fee Nomba deducts for a transfer of sendAmount.
// Tiers confirmed via live test (July 2026): <₦5k→₦10, ₦5k–₦50k→₦25, >₦50k→₦50.
func NombaFee(sendAmount decimal.Decimal) decimal.Decimal {
	switch {
	case sendAmount.LessThan(nombaFiveThou):
		return nombaFee10
	case sendAmount.LessThanOrEqual(nombaFiftyThou):
		return nombaFee25
	default:
		return nombaFee50
	}
}

// GrossUp returns the amount a customer must send so the business receives exactly
// receiveAmount after Nomba's NIP fee deduction. Loops to handle tier-boundary
// crossovers where naive gross-up pushes the send amount into a higher fee tier.
func GrossUp(receiveAmount decimal.Decimal) (sendAmount, fee decimal.Decimal) {
	fee = NombaFee(receiveAmount)
	for {
		sendAmount = receiveAmount.Add(fee)
		actual := NombaFee(sendAmount)
		if actual.Equal(fee) {
			break
		}
		fee = actual
	}
	return
}
