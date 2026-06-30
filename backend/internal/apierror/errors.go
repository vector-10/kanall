package apierror

import (
	"encoding/json"
	"net/http"
)

type APIError struct {
	Code    int    `json:"-"`
	Message string `json:"error"`
}

func (e *APIError) Error() string { return e.Message }
func Forbidden(msg string) *APIError { return &APIError{Code: http.StatusForbidden, Message: msg} }


func NotFound(msg string) *APIError   { return &APIError{Code: http.StatusNotFound, Message: msg} }
func BadRequest(msg string) *APIError { return &APIError{Code: http.StatusBadRequest, Message: msg} }
func Unauthorized() *APIError {
	return &APIError{Code: http.StatusUnauthorized, Message: "unauthorized"}
}
func Conflict(msg string) *APIError { return &APIError{Code: http.StatusConflict, Message: msg} }
func Internal() *APIError {
	return &APIError{Code: http.StatusInternalServerError, Message: "internal server error"}
}
func TooManyRequests() *APIError {
	return &APIError{Code: http.StatusTooManyRequests, Message: "rate limit exceeded"}
}

func Respond(w http.ResponseWriter, err *APIError) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(err.Code)
	json.NewEncoder(w).Encode(err)
}

func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
