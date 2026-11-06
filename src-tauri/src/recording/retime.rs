//! Pause / resume timestamp logic (pure, unit-tested).
//!
//! Samples carry presentation times on the host clock (seconds). A pause is an interval
//! `[pause_at, resume_at)` on that clock: samples inside it are dropped and every later sample is
//! shifted back by the total length of the earlier pauses, so the written movie has no gap.

#[derive(Debug, Default, Clone)]
pub struct Retimer {
    /// Closed pause intervals (start, end), in source time, ordered.
    closed: Vec<(f64, f64)>,
    /// Start of the pause that is still running.
    open: Option<f64>,
}

impl Retimer {
    pub fn new() -> Self {
        Self::default()
    }

    #[allow(dead_code)]
    pub fn is_paused(&self) -> bool {
        self.open.is_some()
    }

    /// Begin a pause at host time `at`. No-op if already paused.
    pub fn pause(&mut self, at: f64) {
        if self.open.is_none() {
            self.open = Some(at);
        }
    }

    /// End the running pause at host time `at`. No-op if not paused.
    pub fn resume(&mut self, at: f64) {
        if let Some(start) = self.open.take() {
            if at > start {
                self.closed.push((start, at));
            }
        }
    }

    /// Total paused time that lies before `t` (the running pause counts up to `t`).
    pub fn paused_before(&self, t: f64) -> f64 {
        let mut total: f64 = self.closed.iter().filter(|(_, hi)| *hi <= t).map(|(lo, hi)| hi - lo).sum();
        if let Some(start) = self.open {
            if t > start {
                total += t - start;
            }
        }
        total
    }

    /// Map a source timestamp to the output timeline; `None` if the sample falls into a pause.
    pub fn map(&self, pts: f64) -> Option<f64> {
        if let Some(start) = self.open {
            if pts >= start {
                return None;
            }
        }
        if self.closed.iter().any(|(lo, hi)| pts >= *lo && pts < *hi) {
            return None;
        }
        Some(pts - self.paused_before(pts))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn no_pause_is_identity() {
        let r = Retimer::new();
        assert_eq!(r.map(100.0), Some(100.0));
    }

    #[test]
    fn samples_in_pause_are_dropped_and_later_ones_shift() {
        let mut r = Retimer::new();
        r.pause(10.0);
        assert!(r.is_paused());
        assert_eq!(r.map(9.99), Some(9.99));
        assert_eq!(r.map(10.0), None);
        assert_eq!(r.map(14.0), None);
        r.resume(15.0);
        assert!(!r.is_paused());
        assert_eq!(r.map(14.99), None);
        // continuous: 15.0 follows 10.0 directly
        assert_eq!(r.map(15.0), Some(10.0));
        assert_eq!(r.map(16.5), Some(11.5));
        // second pause accumulates
        r.pause(20.0);
        r.resume(22.0);
        assert_eq!(r.map(19.0), Some(14.0));
        assert_eq!(r.map(21.0), None);
        assert_eq!(r.map(22.0), Some(15.0));
        assert!((r.paused_before(30.0) - 7.0).abs() < 1e-9);
    }

    #[test]
    fn running_pause_counts_for_end_time() {
        let mut r = Retimer::new();
        r.pause(5.0);
        // recording stopped while paused at host time 8: the movie ends where the pause began
        assert!((8.0 - r.paused_before(8.0) - 5.0).abs() < 1e-9);
    }

    #[test]
    fn double_pause_and_resume_are_idempotent() {
        let mut r = Retimer::new();
        r.pause(1.0);
        r.pause(2.0);
        r.resume(3.0);
        r.resume(4.0);
        assert_eq!(r.map(3.0), Some(1.0));
    }
}
