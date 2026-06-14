package username

import "errors"

var (
	ErrDatabaseNotAvailable = errors.New("database not available")
	ErrExternalAPITimeout   = errors.New("external APIs timeout")
	ErrInvalidUsername      = errors.New("invalid username format")
	ErrReportNotFound       = errors.New("report not found")

	ErrMarketAppUnavailable = errors.New("marketapp API is currently unavailable")
	ErrTonAPIUnavailable    = errors.New("tonAPI is currently unavailable")
	ErrFragmentUnavailable  = errors.New("fragment scraper is currently unavailable")
)
