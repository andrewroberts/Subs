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

// Global Config
// -------------

var SCRIPT_NAME = "Subs"
var SCRIPT_VERSION = "v1.0.dev"

// Private Config
// --------------

// The number is used as an index into an action table
var SUBS_STATE_ = {
  NOSUB:     0, // Not subscribed - trial or full
  STARTED:   1, // User subscribed 
  CANCELLED: 2, // Subscription cancelled, will run until end of subscription period
  EXPIRED:   3, // Subscription expired
}

var SUBS_EVENT_ = {
  START:       0, // User started subscription - trial or full
  CANCEL:      1, // User cancelled subscription
  EXPIRE:      2, // Subscription expired
  ACKNOWLEDGE: 3, // User acknoledged subscription end
}

var PROPERTY_SUBS_STATE_        = SCRIPT_NAME + '_State'        // String SUBS_STATE
var PROPERTY_SUBS_TIME_STARTED_ = SCRIPT_NAME + '_Time_Started' // Number MS
var PROPERTY_SUBS_TRIAL_        = SCRIPT_NAME + '_Trial'        // Boolean

var MS_PER_DAY_ = 1000 * 60 * 60 * 24

var SUBS_DEFAULT_TRIAL_LENGTH_ = MS_PER_DAY_ * 15
var SUBS_DEFAULT_FULL_LENGTH_  = MS_PER_DAY_ * 365

// Code
// ----

function get(properties, log) {
  return Subs_.get(properties, log)
}

var Subs_ = (function(ns) {

  

  /**
   * Get an Subs "instance"
   *
   * @param {PropertiesService} properties
   */
   
  ns.get = function(properties, log) {
  
    var newSub = Object.create(this)
    newSub.properties = properties
    newSub.log = log
    return newSub
    
  } // Subs_.get

  /**
   * Get User subscription status
   *
   * @return {USER_STATUS} status
   */
   
  ns.getState = function() {
  
    this.log.functionEntryPoint()
    
    var state = this.properties.getProperty(PROPERTY_SUBS_STATE_)
    
    if (state === null) {
    
      state = SUBS_STATE_.NOSUB
      
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

    var trial = this.properties.getProperty(PROPERTY_SUBS_TRIAL_)
    
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

    var timeStarted = this.properties.getProperty(PROPERTY_SUBS_TIME_STARTED_)
    
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
   */

  ns.processEvent = function(event) {
  
    this.log.functionEntryPoint()
    this.log.fine('event: ' + JSON.stringify(event))
    
    var SUBS_TABLE = [
      
      /* State/Event      0. START    1. CANCEL     2. EXPIRE   3. ACKNOWLEDGE */
      /* -----------      ----------  ---------     ---------   -------------- */
      /* 0. NOSUB     */  [started,     NO_ACT,       NO_ACT,     NO_ACT],              
      /* 1. STARTED   */  [NO_ACT,      cancelled,    expired,    NO_ACT],
      /* 2. CANCELLED */  [started,     NO_ACT,       expired,    NO_ACT],
      /* 3. EXPIRED   */  [started,     NO_ACT,       NO_ACT,     noSub ]
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
    
    if (config.oldState === SUBS_STATE_.NEW) {
    
      if (config.oldTrial) {      
        Subs_.throwError('The trial flag is set but there is no subscription')
      }
    }

    // Call the appropriate action function
    SUBS_TABLE[config.oldState][event.event](config)
    
    return

    // Private Functions
    // -----------------

    function NO_ACT(config) {
      this.log.warning('Unexpected state (' + config.oldState + ')/Event(' + event.event + ')')
    }
    
    /**
     * User is starting a new subscription
     */
    
    function started(config) {

      this.log.functionEntryPoint()
      updateProperties(event.trial, SUBS_STATE_.STARTED, (new Date()).getTime())
    
    } // Subs_.processEvent.started()

    /**
     * User has cancelled their subscription
     */
    
    function cancelled(config) {

      this.log.functionEntryPoint()
      updateProperties(event.trial, SUBS_STATE_.CANCELLED, config.oldTimeStarted)
    
    } // Subs_.processEvent.newSubscription()

    /**
     * The subscription timer has expired
     */
    
    function expired(config) {

      this.log.functionEntryPoint()
      updateProperties(null, SUBS_STATE_.EXPIRED, null)
    
    } // Subs_.processEvent.expired()

    /**
     * The subscription has finshed and been acknoledged by the user
     */
    
    function noSub(config) {

      this.log.functionEntryPoint()
      updateProperties(null, SUBS_STATE_.NOSUB, null)
    
    } // Subs_.processEvent.expired()

    /**
     * Update the user subscription properties
     *
     * @param {SUBS_STATE} status
     * @param {Boolean} trial or {Object} null to delete
     * @param {Number} timeStarted or {Object} null to delete
     */ 

    function updateProperties(newTrial, newState, newTimeStarted) {
    
      this.log.functionEntryPoint()
      this.log.fine('newTrial: %s', newTrial)      
      this.log.fine('newState: %s', newState)
      this.log.fine('newTimeStarted: %s', newTimeStarted)
      
      var callingfunction = 'Subs_.processEvent.updateProperties()'
      
      // Status
      
      _state = newState
      this.properties.setProperty(PROPERTY_SUBS_STATE_, newState)
      
      // Trial
      
      if (typeof newTrial === 'boolean') {
      
        this.properties.setProperty(PROPERTY_SUBS_TRIAL_, newTrial)
        
      } else if (typeof newTrial === 'object') {
        
        if (newTrial === null) {
        
          this.properties.deleteProperty(PROPERTY_SUBS_TRIAL_)      
          
        } else {
        
          Subs_.throwError('Trying to set "trial" to bad object')
        }
        
      } else {
      
        Subs_.throwError('Trying to set "trial" to bad type')      
      }
      
      // Time started
      
      if (typeof newTimeStarted === 'number') {
      
        this.properties.setProperty(PROPERTY_SUBS_TIME_STARTED_, newTimeStarted)
      
      } else if (typeof newTimeStarted === 'object') {
        
        if (newTimeStarted === null) {
        
          this.properties.deleteProperty(PROPERTY_SUBS_TIME_STARTED_)      
          
        } else {
        
          Subs_.throwError('Trying to set "trial" to bad object')
        }
      }

    } // Subs_.processEvent.updateProperties()

  } // Subs_.processEvent_()
  
  /**
   * Check if trial expired
   *
   * @return {Object}
   */
   
  ns.checkExpired = function() {
  
    this.log.functionEntryPoint()
    
    var status = this.properties.getProperty(PROPERTY_SUBS_STATE_)
    
    if (status === SUBS_STATE_.TRIAL) {
    
      var trialStartedString = this.properties.getProperty(PROPERTY_SUBS_TIME_STARTED_)
      
      if (trialStartedString === null) {
        Subs_.throwError('User is in a trial, but the trial timer has been cleared')
      }
      
      var trialStarted = parseInt(trialStartedString, 10)
      
      // Test for NaN
      if (trialStarted !== trialStarted) {
        Subs_.throwError('The trial timer has been corrupted: ' + trialLength)      
      }
      
      var today = (new Date()).getTime()
      var trialLength = today - trialStarted

      if (trialLength < 0) {
        Subs_.throwError('The trial timer has been corrupted: ' + trialStartedString)      
      }
      
      if (trialLength > TRIAL_LENGTH) {
        Subs_.processEvent(SUBS_STATE_.TRIAL_ENDED)
        this.properties.deleteProperty(PROPERTY_SUBS_TIME_STARTED_)     
      }
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
    if (config.oldState === SUBS_STATE_.SUBSCRIBED && !config.oldTrial) {
    
      // Leave "subscribed" 
      Subs_.processEvent_(SUBS_STATE_.SUBSCRIBED)
      
    } else {
    
       // ??
      Subs_.processEvent(SUBS_STATE_.NEW) 
    }

    this.properties.deleteProperty(PROPERTY_SUBS_TIME_STARTED_)    
*/    
    throw new Error(message)
  
  } // Subs_.throwError()

  return ns

})(Subs_ || {})

