package main

import (
	// for suspending and resuming the process
	"github.com/shirou/gopsutil/v3/process"

	"strings"
	"time"

	"log"
)

const (
	inactivityDuration = 20 * time.Second
	// how often to check for inactivity
	inactivityInterval  = 10 * time.Second
	maintenanceInterval = 5 * time.Minute
	maintenanceDuration = 5 * time.Second
	processName         = "Cemu_"
)

var (
	lastActivityTime = time.Now()
	activityNotifier = make(chan struct{})
	// when this is true it will no longer:
	// attempt to keep suspending and spam the console
	// and will let you manually unsuspend by hand instead of fighting with you
	processSuspended = true
	// defaults to true so that it will unsuspend on startup (good)
)

// findProcessesByName searches for processes with a command line containing the target string.
func findProcessesByName(target string) ([]*process.Process, error) {
	var procs []*process.Process
	allProcs, err := process.Processes()
	if err != nil {
		return nil, err
	}

	for _, p := range allProcs {
		cmdline, err := p.Cmdline()
		if err == nil && strings.Contains(cmdline, target) {
			procs = append(procs, p)
		}
	}
	return procs, nil
}

// manageProcessState changes the state of processes with the target name.
func manageProcessState(target string, suspend bool) {
	// If the desired state matches the current state, no action is needed.
	if processSuspended == suspend {
		return
	}
	procs, err := findProcessesByName(target)
	if err != nil {
		log.Println("Error finding processes:", err)
		return
	}

	if len(procs) == 0 {
		log.Println("No", target, "processes found.")
		return
	}

	for _, p := range procs {
		var err error
		if suspend {
			err = p.Suspend()
			if err == nil {
				log.Println("Suspended process:", p.Pid)
			}
		} else {
			err = p.Resume()
			if err == nil {
				log.Println("Resumed process:", p.Pid)
			}
		}

		if err != nil {
			log.Println("Error changing process state:", err)
		} else {
			// Update the tracked state to reflect the successful action.
			processSuspended = suspend
		}
	}
}

// monitorActivityAndManageProcess monitors process activity and adjusts process states as needed,
// introducing maintenance windows and ensuring responsiveness to activity.
func monitorActivityAndManageProcess() {
	// Ensure that any initially suspended processes are resumed when starting.
	manageProcessState(processName, false)

	ticker := time.NewTicker(inactivityInterval)
	defer ticker.Stop()

	maintenanceTimer := time.NewTimer(maintenanceInterval)
	// for whatever reason this just hangs forever and I'm not sure why this was added
	if !maintenanceTimer.Stop() {
		select {
		case <-maintenanceTimer.C: // Drain the timer if it was stopped successfully.
		default:
		}
	}

	for {
		select {
		case <-activityNotifier:
			// Activity detected: reset the last activity time and ensure the target process is active.
			lastActivityTime = time.Now()
			manageProcessState(processName, false)
			log.Println("Activity detected; process resumed if it was suspended.")

			// Reset the maintenance timer whenever there's new activity.
			if !maintenanceTimer.Stop() {
				select {
				case <-maintenanceTimer.C:
				default:
				}
			}
			maintenanceTimer.Reset(maintenanceInterval)

		case <-ticker.C:
			// Regular check: Suspend the process if it has been inactive for the specified duration.
			if time.Since(lastActivityTime) > inactivityDuration {
				manageProcessState(processName, true)
				//log.Println("Process suspended due to inactivity.")
			}

		case <-maintenanceTimer.C:
			// Maintenance window: temporarily resume the process for maintenance activities.
			manageProcessState(processName, false)
			log.Println("Maintenance window: Process resumed for maintenance.")

			// Wait for the maintenance duration or an activity signal.
			select {
			case <-time.After(maintenanceDuration):
				// If no activity, re-suspend the process after maintenance.
				if time.Since(lastActivityTime) >= maintenanceDuration {
					manageProcessState(processName, true)
					log.Println("Maintenance completed; process re-suspended.")
				}
			case <-activityNotifier:
				// If there's activity during maintenance, reset the last activity time
				// and keep the process running to handle the activity.
				lastActivityTime = time.Now()
				log.Println("Activity detected during maintenance; keeping process running.")
			}

			// Prepare for the next maintenance window.
			maintenanceTimer.Reset(maintenanceInterval)
		}
	}
}

// notifyActivity is called to signal activity. It's non-blocking.
func notifyActivity() {
	select {
	case activityNotifier <- struct{}{}:
	default:
		// If the channel is already full, there's no need to block or add another notification.
	}
}
