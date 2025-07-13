import { supabase } from "./supabase"

export class SessionManager {
  private static readonly SESSION_KEY = 'raptor-session-info'
  private static readonly ACTIVITY_KEY = 'raptor-last-activity'
  private static readonly SESSION_DURATION = 4 * 60 * 60 * 1000 // 4 hours in milliseconds
  private static activityTimer: NodeJS.Timeout | null = null

  /**
   * Initialize session management
   */
  static init() {
    if (typeof window === 'undefined') return

    // Update activity on page load
    this.updateActivity()

    // Set up activity listeners
    this.setupActivityListeners()

    // Start activity checker
    this.startActivityChecker()

    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.updateActivity()
        this.checkSession()
      }
    })
  }

  /**
   * Update last activity timestamp
   */
  static updateActivity() {
    if (typeof window === 'undefined') return
    
    const now = Date.now()
    localStorage.setItem(this.ACTIVITY_KEY, now.toString())
    
    // Also store in session storage for tab-specific tracking
    sessionStorage.setItem('raptor-tab-active', now.toString())
  }

  /**
   * Check if session is still valid
   */
  static isSessionValid(): boolean {
    if (typeof window === 'undefined') return false

    const lastActivity = localStorage.getItem(this.ACTIVITY_KEY)
    if (!lastActivity) return false

    const timeSinceActivity = Date.now() - parseInt(lastActivity)
    return timeSinceActivity < this.SESSION_DURATION
  }

  /**
   * Set up activity listeners
   */
  private static setupActivityListeners() {
    if (typeof window === 'undefined') return

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    events.forEach(event => {
      document.addEventListener(event, this.throttledUpdateActivity, true)
    })
  }

  /**
   * Throttled activity update (max once per minute)
   */
  private static throttledUpdateActivity = (() => {
    let lastUpdate = 0
    return () => {
      const now = Date.now()
      if (now - lastUpdate > 60000) { // 1 minute throttle
        this.updateActivity()
        lastUpdate = now
      }
    }
  })()

  /**
   * Start the activity checker
   */
  private static startActivityChecker() {
    if (this.activityTimer) {
      clearInterval(this.activityTimer)
    }

    // Check every minute
    this.activityTimer = setInterval(() => {
      this.checkSession()
    }, 60000)
  }

  /**
   * Check session validity and handle logout
   */
  static async checkSession() {
    if (typeof window === 'undefined') return

    try {
      // Check if we have a valid session
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('Session check error:', error)
        return
      }

      if (!session) {
        // No session, user needs to login
        this.handleSessionExpired()
        return
      }

      // Check activity-based expiration
      if (!this.isSessionValid()) {
        console.log('⏰ Session expired due to inactivity')
        await this.logout('Session expired due to 4 hours of inactivity')
        return
      }

      // Session is valid, update stored session info
      this.storeSessionInfo(session)

    } catch (error) {
      console.error('Session check failed:', error)
    }
  }

  /**
   * Store session information
   */
  private static storeSessionInfo(session: any) {
    if (typeof window === 'undefined') return

    const sessionInfo = {
      user: session.user,
      expires_at: session.expires_at,
      access_token: session.access_token ? 'present' : 'missing',
      stored_at: Date.now()
    }

    localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionInfo))
  }

  /**
   * Get stored session info
   */
  static getStoredSessionInfo() {
    if (typeof window === 'undefined') return null

    try {
      const stored = localStorage.getItem(this.SESSION_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  }

  /**
   * Handle session expiration
   */
  private static handleSessionExpired() {
    console.log('🔒 Session expired, redirecting to login')
    
    // Clear stored data
    this.clearSessionData()
    
    // Redirect to login with message
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname
      window.location.href = `/auth/login?expired=true&returnUrl=${encodeURIComponent(currentPath)}`
    }
  }

  /**
   * Logout user
   */
  static async logout(reason?: string) {
    try {
      console.log('🔓 Logging out user:', reason || 'Manual logout')
      
      // Sign out from Supabase
      await supabase.auth.signOut()
      
      // Clear all stored data
      this.clearSessionData()
      
      // Show message and redirect
      if (typeof window !== 'undefined') {
        const message = reason || 'You have been logged out'
        window.location.href = `/auth/login?message=${encodeURIComponent(message)}`
      }
      
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  /**
   * Clear all session data
   */
  private static clearSessionData() {
    if (typeof window === 'undefined') return

    // Clear localStorage
    localStorage.removeItem(this.SESSION_KEY)
    localStorage.removeItem(this.ACTIVITY_KEY)
    localStorage.removeItem('raptor-auth-token')
    
    // Clear sessionStorage
    sessionStorage.removeItem('raptor-tab-active')
    
    // Clear activity timer
    if (this.activityTimer) {
      clearInterval(this.activityTimer)
      this.activityTimer = null
    }
  }

  /**
   * Refresh session if needed
   */
  static async refreshSession() {
    try {
      const { data, error } = await supabase.auth.refreshSession()
      
      if (error) {
        console.error('Session refresh failed:', error)
        return false
      }
      
      if (data.session) {
        this.storeSessionInfo(data.session)
        this.updateActivity()
        console.log('✅ Session refreshed successfully')
        return true
      }
      
      return false
    } catch (error) {
      console.error('Session refresh error:', error)
      return false
    }
  }

  /**
   * Extend session (reset activity timer)
   */
  static extendSession() {
    this.updateActivity()
    console.log('⏱️ Session extended')
  }

  /**
   * Get session status for debugging
   */
  static getSessionStatus() {
    const lastActivity = localStorage.getItem(this.ACTIVITY_KEY)
    const sessionInfo = this.getStoredSessionInfo()
    
    return {
      isValid: this.isSessionValid(),
      lastActivity: lastActivity ? new Date(parseInt(lastActivity)) : null,
      timeSinceActivity: lastActivity ? Date.now() - parseInt(lastActivity) : null,
      sessionDuration: this.SESSION_DURATION,
      storedSession: sessionInfo ? {
        user: sessionInfo.user?.email,
        storedAt: new Date(sessionInfo.stored_at)
      } : null
    }
  }
}

// Initialize on client side
if (typeof window !== 'undefined') {
  SessionManager.init()
}