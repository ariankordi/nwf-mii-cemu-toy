// +build !arian

package main

func handleConnectionRefused(err error) {
	if !isConnectionRefused(err) {
		return
	}

	/*if eventID := sentry.CaptureException(err); eventID != nil {
		log.Print("(Event ID: "+*eventID+")")
	}
	*/
}
