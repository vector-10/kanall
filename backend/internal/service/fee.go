package service

import "github.com/shopspring/decimal"

var (
	nombaFiveThou  = decimal.NewFromInt(5000)
	nombaFiftyThou = decimal.NewFromInt(50000)
	nombaFee10     = decimal.NewFromInt(10)
	nombaFee25     = decimal.NewFromInt(25)
	nombaFee50     = decimal.NewFromInt(50)
)


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
