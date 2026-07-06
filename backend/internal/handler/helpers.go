package handler

import (
	"log"
	"net/http"

	"github.com/vector-10/kanall/internal/apierror"
	"github.com/vector-10/kanall/internal/middleware"
)

func internalError(w http.ResponseWriter, r *http.Request, err error) {
	log.Printf("[%s] 500 %s %s: %v", middleware.GetRequestID(r.Context()), r.Method, r.URL.Path, err)
	apierror.Respond(w, apierror.Internal())
}
