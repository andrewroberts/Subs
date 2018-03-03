// 34567890123456789012345678901234567890123456789012345678901234567890123456789

// JSHint - TODO
/* jshint asi: true */

(function() {"use strict"})()

// Subs_.gs
// =======
//
// Dev: AndrewRoberts.net
//
// Object for managing user subscriptions

/*
 TODO
 ----

 - Stop user from being able to subscribe for another trial
 - Set PROPERTY_TRIAL_LENGTH_ & PROPERTY_FULL_LENGTH_
 - Don't use property service for persistent storage but call backs from user (for
   potentially storing in Firebase, where we can change it) - Look at the Property
   lib I wrote
 - Test trial expiration
 - Test trying to get two trials
 - Think about which situations warrant throwing an error, and which passing an
   error message back to the user.
 - Check for error message in tests
 
*/

// Global Config
// -------------

var SCRIPT_NAME = "Subs"
var SCRIPT_VERSION = "v1.0.dev"

// The number is used as an index into an action table
var SUBS_STATE = Object.freeze({
  NOSUB:     0, // Not subscribed - trial or full
  STARTED:   1, // User subscribed 
  CANCELLED: 2, // Subscription cancelled, will run until end of subscription period
  EXPIRED:   3, // Subscription expired
})

var SUBS_EVENT = Object.freeze({
  START:       0, // User started subscription - trial or full
  CANCEL:      1, // User cancelled subscription
  EXPIRE:      2, // Subscription expired
  ACKNOWLEDGE: 3, // User acknoledged subscription end
})

// Private Config
// --------------

var PROPERTY_STATE_         = SCRIPT_NAME + '_State'         // String SUBS_STATE
var PROPERTY_TIME_STARTED_  = SCRIPT_NAME + '_Time_Started'  // Number mS
var PROPERTY_TRIAL_         = SCRIPT_NAME + '_Trial'         // Boolean
var PROPERTY_TRIAL_EXPIRED_ = SCRIPT_NAME + '_Trial_Expired' // 'true' or not-set (null)

var MS_PER_DAY_ = 1000 * 60 * 60 * 24

var DEFAULT_TRIAL_LENGTH_ = MS_PER_DAY_ * 15
var DEFAULT_FULL_LENGTH_  = (MS_PER_DAY_ * 365) - DEFAULT_TRIAL_LENGTH_

// Code
// ----

function get(properties, log) {
  return Subs_.get(properties, log)
}

var Subs_ = (function(ns) {

  ns.properties = null
  ns.log        = null

  /**
   * Get an Subs "instance"
   *
   * @param {PropertiesService} properties
   */
   
  ns.get = function(properties, log) {
  
    var newSub = Object.create(this)
    this.properties = properties
    this.log = log
    return newSub
    
  } // Subs_.get

  /**
   * Get User subscription status
   *
   * @return {USER_STATUS} status
   */
   
  ns.getState = function() {
  
    this.log.functionEntryPoint()
    
    var state = this.properties.getProperty(PROPERTY_STATE_)
    
    if (state === null) {
    
      state = SUBS_STATE.NOSUB
      
    } else {
    
      var stateNumber = parseInt(state, 10)
      
      if (stateNumber !== stateNumber) { // Test for NaN
      
        throw new Error('Subs state is corrupt: ' +  state)
        
      } else {
      
        state = stateNumber
      }
    }
    
    this.log.fine('state: ' + state)
    return state
  
  } // Subs_.getState() 
  
  /**
   * Is this a trial or not
   *
   * @return {Boolean} is this a trial or not or {Object} null
   */
   
  ns.isTrial = function() {
  
    this.log.functionEntryPoint()

    var trial = this.properties.getProperty(PROPERTY_TRIAL_)
    
    if (trial !== null) {
    
      if (trial === 'true') {
      
        trial = true
        
      } else if (trial === 'false') {
        
        trial = false
        
      } else {
      
        throw new Error('Corrupt "trial": ' + trial)
      }
    }
    
    return trial
  
  } // Subs_.isTrial() 

  /**
   * Get the time the subscription timer started
   *
   * @return {Number} ms since start or {Object} null
   */
   
  ns.getTimeStarted = function () {
  
    this.log.functionEntryPoint()

    var timeStarted = this.properties.getProperty(PROPERTY_TIME_STARTED_)
    
    if (timeStarted !== null) {
    
      var timeStartedNumber = parseInt(timeStarted, 10)
      
      if (timeStartedNumber !== timeStartedNumber) { // Test for NaN
      
        throw new Error('Subs time started is corrupt: ' +  timeStarted)
        
      } else {
      
        timeStarted = timeStartedNumber
      }
    }
    
    return timeStarted
  
  } // Subs_.getTimeStarted() 
  
  /**
   * Process a new "subscription" event 
   *
   * @param {Object} event
   *   {SUBS_EVENT_} event
   *   {Boolean} trial
   *
   * @return {String} errorMessage or ''
   */

  ns.processEvent = function(event) {
  
    var log = this.log
    log.functionEntryPoint()
    log.fine('event: ' + JSON.stringify(event))
    
    var self = this
    
    var SUBS_TABLE = [
      
      /* State/Event      0. START    1. CANCEL     2. EXPIRE    3. ACKNOWLEDGE */
      /* -----------      ----------  ---------     ---------    -------------- */
      /* 0. NOSUB     */  [started,    noAction,     noAction,    noAction],              
      /* 1. STARTED   */  [noAction,   cancelled,    expired,     noAction],
      /* 2. CANCELLED */  [started,    noAction,     expired,     noAction],
      /* 3. EXPIRED   */  [started,    noAction,     noAction,    noSub ]
    ]
    
    var config = {

      oldTrial:       Subs_.isTrial(),
      newTrial:       null,

      oldState:       Subs_.getState(),
      newState:       null,
      
      oldTimeStarted: Subs_.getTimeStarted(),
      newTimeStarted: null,
      
      event:          event.event,
    }
    
    this.log.fine('config: ' + JSON.stringify(config))
    
    if (config.oldState === SUBS_STATE.NOSUB) {
    
      if (config.oldTrial) {      
        this.throwError('The trial flag is set but there is no subscription')
      }
    }

    // Call the appropriate action function
    var errorMessage = SUBS_TABLE[config.oldState][event.event](config)
    
    return errorMessage

    // Private Functions
    // -----------------

    function noAction(config) {
    
      log.functionEntryPoint()    
      log.warning('Unexpected state (' + config.oldState + ')/Event(' + event.event + ')')
      return ''
      
    } // Subs_.processEvent.noAction()
    
    /**
     * User is starting a new subscription
     */
    
    function started(config) {

      log.functionEntryPoint()
      
      if (config.oldTrial && this.properties.getProperty(PROPERTY_TRIAL_EXPIRED_) !== null) {
        return 'The user has already had one trial'
      }
      
      return updateProperties(event.trial, SUBS_STATE.STARTED, (new Date()).getTime())
    
    } // Subs_.processEvent.started()

    /**
     * User has cancelled their subscription
     */
    
    function cancelled(config) {

      log.functionEntryPoint()
      return updateProperties(event.trial, SUBS_STATE.CANCELLED, config.oldTimeStarted)
    
    } // Subs_.processEvent.newSubscription()

    /**
     * The subscription timer has expired
     */
    
    function expired(config) {

      log.functionEntryPoint()
      
      // Ensure the user can only use the trial once
      this.properties.setProperty(PROPERTY_TRIAL_EXPIRED_, 'true')
      
      return updateProperties(null, SUBS_STATE.EXPIRED, null)
    
    } // Subs_.processEvent.expired()

    /**
     * The subscription has finshed and been acknowledged by the user
     */
    
    function noSub(config) {

      log.functionEntryPoint()
      return updateProperties(null, SUBS_STATE.NOSUB, null)
    
    } // Subs_.processEvent.expired()

    /**
     * Update the user subscription properties
     *
     * @param {SUBS_STATE} status
     * @param {Boolean} trial or {Object} null to delete
     * @param {Number} timeStarted or {Object} null to delete
     */ 

    function updateProperties(newTrial, newState, newTimeStarted) {
    
      log.functionEntryPoint()
      log.fine('newTrial: %s', newTrial)      
      log.fine('newState: %s', newState)
      log.fine('newTimeStarted: %s', newTimeStarted)

      var properties = self.properties

      // Status
      
      properties.setProperty(PROPERTY_STATE_, newState)
      
      // Trial
      
      if (typeof newTrial === 'boolean') {
      
        properties.setProperty(PROPERTY_TRIAL_, newTrial)
        
      } else if (typeof newTrial === 'object') {
        
        if (newTrial === null) {
        
          properties.deleteProperty(PROPERTY_TRIAL_)     
          
        } else {
        
          self.throwError('Trying to set "trial" to bad object')
        }
        
      } else {
      
        self.throwError('Trying to set "trial" to bad type')      
      }
      
      // Time started
      
      if (typeof newTimeStarted === 'number') {
      
        properties.setProperty(PROPERTY_TIME_STARTED_, newTimeStarted)
      
      } else if (typeof newTimeStarted === 'object') {
        
        if (newTimeStarted === null) {
        
          properties.deleteProperty(PROPERTY_TIME_STARTED_)      
          
        } else {
        
          self.throwError('Trying to set "trial" to bad object')
        }
      }
      
      return ''

    } // Subs_.processEvent.updateProperties()

  } // Subs_.processEvent_()
  
  /**
   * Check if subscription expired - this needs to be automatically 
   * run daily
   */
   
  ns.checkIfExpired = function() {
  
    this.log.functionEntryPoint()
    var properties = this.properties
    
    var status = properties.getProperty(PROPERTY_STATE_)
    var inTrial = this.isTrial()
    
    if (status !== SUBS_STATE.STARTED || status !== SUBS_STATE.CANCELLED) {
      return
    }
    
    var startedString = properties.getProperty(PROPERTY_TIME_STARTED_)
    
    if (startedString === null) {
      this.throwError('User is in a trial, but the trial timer has been cleared')
    }
    
    var started = parseInt(startedString, 10)
    
    // Test for NaN
    if (started !== started) {
      this.throwError('The trial timer has been corrupted: ' + trialLength)      
    }
    
    var today = (new Date()).getTime()
    var totalTime = today - started
    
    if (totalTime < 0) {
      this.throwError('The trial timer has been corrupted: ' + startedString)      
    }
    
    var subLength
    
    if (inTrial) {
      
      subLength = properties.getProperty(PROPERTY_TRIAL_LENGTH_)
      
    } else {
      
      subLength = properties.getProperty(PROPERTY_FULL_LENGTH_)
    }
    
    if (subLength === null) {
      this.throwError('The subscription time length is not set')
    }
    
    subLength = parseInt(subLength, 10)
    
    // Test for subLength
    if (subLength !== subLength) {
      this.throwError('The subscription time length has been corrupted: "' + subLength + '"')      
    }
    
    if (totalTime > subLength) {
      this.processEvent({event: SUBS_STATE.EXPIRED, trial: inTrial})
    }
    
  } // Subs_.checkTrialExpired() 

  /**
   * Handle an error thrown during subscription
   *
   * @param {message} error
   *
   * @return {Object}
   */
   
  ns.throwError = function handleError(message) {
  
    this.log.functionEntryPoint()   
 /*   
    if (config.oldState === SUBS_STATE.SUBSCRIBED && !config.oldTrial) {
    
      // Leave "subscribed" 
      Subs_.processEvent_(SUBS_STATE.SUBSCRIBED)
      
    } else {
    
       // ??
      Subs_.processEvent(SUBS_STATE.NEW) 
    }

    this.properties.deleteProperty(PROPERTY_TIME_STARTED_)    
*/    
    throw new Error(message)
  
  } // Subs_.throwError()

  return ns

})(Subs_ || {})

