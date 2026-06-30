package handler

import (
	"log"
	"net/http"

	"github.com/vector-10/kanall/internal/apierror"
)

func internalError(w http.ResponseWriter, r *http.Request, err error) {
	log.Printf("500 %s %s: %v", r.Method, r.URL.Path, err)
	apierror.Respond(w, apierror.Internal())
}
