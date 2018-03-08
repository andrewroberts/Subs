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

  Copyright 2018 Andrew Roberts
  
  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at
  
      http://www.apache.org/licenses/LICENSE-2.0
  
  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.

*/

/*
 TODO
 ----

 - Set PROPERTY_.TRIALLENGTH_ & PROPERTY_FULL_LENGTH_
 - Test trial expiration
 - Test trying to get two trials
 - Think about which situations warrant throwing an error, and which passing an
   error message back to the user.
 - Check for error message in tests
 - Stop user from being able to subscribe for another trial
 - What state to leave in after an error??
 - What happens to the timer if a sub is cancelled - 
 - Add "trial finished" to updateProperties()
 - Start/stop expiration timer
 - Do we need the null states, rather than just true or false

*/

// Global Config
// -------------

var SCRIPT_NAME    = "Subs"
var SCRIPT_VERSION = "v1.0.dev"

// The number is used as an index into an action table

var SUBS_STATE = Object.freeze({
  NOSUB:     0, // Not subscribed - trial or full
  STARTED:   1, // User subscribed 
  CANCELLED: 2, // Subscription cancelled, will run until end of subscription period
  EXPIRED:   3, // Subscription expired
})

var EVENT_OFFSET_ = 100

// Although this is just used as an index it is given an offset so as not to be 
// accidentally confused with the state values

var SUBS_EVENT = Object.freeze({
  START:       EVENT_OFFSET_ + 0, // User started subscription - trial or full
  CANCEL:      EVENT_OFFSET_ + 1, // User cancelled subscription
  EXPIRE:      EVENT_OFFSET_ + 2, // Subscription expired
  ACKNOWLEDGE: EVENT_OFFSET_ + 3, // User acknoledged subscription end
})

// Private Config
// --------------

var PROPERTY_ = Object.freeze({
  STATE          : SCRIPT_NAME + '_State',          // {SUBS_STATE}
  TIME_STARTED   : SCRIPT_NAME + '_Time_Started',   // {number} mS
  TRIAL          : SCRIPT_NAME + '_Trial',          // {boolean}
  TRIAL_FINISHED : SCRIPT_NAME + '_Trial_Finished', // {boolean} 
})

var TIMER_NOT_STARTED_ = -1

var IN_TRIAL_ = Object.freeze({
  TRUE  : true,
  FALSE : false
})

var TRIAL_FINISHED = Object.freeze({
  TRUE  : true,
  FALSE : false
})

var MS_PER_DAY_ = 1000 * 60 * 60 * 24

var DEFAULT_TRIAL_LENGTH_ = MS_PER_DAY_ * 15
var DEFAULT_FULL_LENGTH_  = (MS_PER_DAY_ * 365) - DEFAULT_TRIAL_LENGTH_

// Dummy logging object
var Log_ = {
  functionEntryPoint : function() {},
  finest             : function() {},
  finer              : function() {},
  fine               : function() {},
  info               : function() {},
  warning            : function() {},
}

// Public Code
// -----------

/**
 * The Subs_ config parameter object
 *
 * @typedef {object} SubsEvent
 * @property {SUBS_EVENT} event - The Subs event
 * @property {boolean | object} isTrial - Whether this an event for a trial or null if N/A 
 */

/**
 * The Subs_ event parameter object
 *
 * @typedef {object} SubsGetConfig
 * @property {number} trialLength - The length of a trial in days
 * @property {number} fullLength - The length of a trial in days 
 * @property {PropertiesService} properties - PropertiesService
 * @property {BBLog} log - Logging object
 */

/**
 * Public method to get a subscription object
 *  
 * @param {SubsGetConfig} config - {@link SubsGetConfig} 
 *
 * @return {Subs_} object 
 */
 
function get(config) {
  return Subs_.get(config)
}

// Private Code
// ------------

var Subs_ = (function(ns) {

  ns.properties  = null
  ns.log         = null
  ns.trialLength = null
  ns.fullLength  = null

  /**
   * Private method to get a subscription object
   *
   * @param {SubsGetConfig} config - {@link SubsGetConfig} 
   *
   * @return {Subs_} object 
   */
   
  ns.get = function(config) {

    var self = this

    checkProperties()
    this.properties = config.properties
    initialiseProperty(PROPERTY_.STATE,          SUBS_STATE.NOSUB)
    initialiseProperty(PROPERTY_.TIME_STARTED,   TIMER_NOT_STARTED_)
    initialiseProperty(PROPERTY_.TRIAL,          IN_TRIAL_.FALSE)
    initialiseProperty(PROPERTY_.TRIAL_FINISHED, TRIAL_FINISHED.FALSE)

    this.log = config.log || Log_
    
    initialiseSubLength('trialLength', DEFAULT_TRIAL_LENGTH_)
    initialiseSubLength('fullLength', DEFAULT_FULL_LENGTH_)
 
    this.log.fine('New Subs: ' + JSON.stringify(this))
    
    return Object.create(this)
    
    // Private Functions
    // -----------------

    /**
     * Check that a properties object has been passed 
     */
     
    function checkProperties() {
  
      if (!config.hasOwnProperty('properties')) {
      
        throw new Error('config.properties not defined')
      }
      
    } // Subs_.get.checkProperties()

    /**
     * Intialise the properties that are held externally
     *
     * @param 
     */
     
    function initialiseProperty(name, value) {

      var properties = self.properties

      if (properties.getProperty(name) === null) {
        properties.setProperty(name, value)
      }
      
    } // Subs_.get.initialiseProperty()

    /**
     * Initialise the subscription length
     */
     
    function initialiseSubLength(name, defaultValue) {
    
      if (!config.hasOwnProperty(name)) {
      
        self.log.warning('Using default ' + name + ': ' + (defaultValue / MS_PER_DAY_))
        self[name] = defaultValue
        
      } else {
      
        self[name] = config[name]
      }
      
    } // Subs_.get.initialiseSubLength()

  } // Subs_.get()

  /**
   * Get user subscription state
   *
   * @return {SUBS_STATE} state
   */
   
  ns.getState = function() {
  
    checkInitialised(this)
    this.log.functionEntryPoint()
    
    var state = parseInt(this.properties.getProperty(PROPERTY_.STATE), 10)
    
    if (state !== state) { // Test for NaN   
      throw new Error('Subs state is not a number: ' +  state)
    }
    
    if (state >= Object.keys(SUBS_STATE).length) {
      throw new Error('Subs state is outside expected range: ' +  state)
    }
   
    this.log.fine('state: ' + state)
    return state
  
  } // Subs_.getState() 
  
  /**
   * Is there a trial subscription running or not
   *
   * @return {boolean | object} is this a trial or not or {Object} null
   */
   
  ns.isTrial = function() {
  
    checkInitialised(this)
    this.log.functionEntryPoint()
    var trial = castBoolean(this.properties.getProperty(PROPERTY_.TRIAL))
    this.log.fine('isTrial: ' + trial)
    return trial
  
  } // Subs_.isTrial() 

  /**
   * @return {boolean} Whether the trial has finished
   */

  ns.isTrialFinished = function() {
  
    checkInitialised(this)  
    this.log.functionEntryPoint()
    var trialFinished = castBoolean(this.properties.getProperty(PROPERTY_.TRIAL_FINISHED))
    this.log.fine('trialFinished: ' + trialFinished)
    return trialFinished
  
  } // Subs_.isTrialFinished()

  /**
   * Get the time the subscription timer started
   *
   * @return {Number} ms since start or -1 if not started
   */
   
  ns.getTimeStarted = function() {
  
    checkInitialised(this)  
    this.log.functionEntryPoint()

    var timeStarted = parseFloat(this.properties.getProperty(PROPERTY_.TIME_STARTED))
      
    if (timeStarted !== timeStarted) {       
      throw new Error('Subs time started is not a number: ' +  timeStarted)
    }
    
    return timeStarted
  
  } // Subs_.getTimeStarted() 
  
  /**
   * Process a new "subscription" event 
   *
   * @param {Object} event
   *   {SUBS_EVENT_} event
   *   {boolean} isTrial
   *
   * @return {String} errorMessage or ''
   */

  ns.processEvent = function(event) {
  
    checkInitialised(this)  
    var log = this.log    
    log.functionEntryPoint()
    log.fine('event: ' + JSON.stringify(event))
    
    checkParameters()
    
    var self = this
    
    var SUBS_TABLE = [
      
      /* State/Event      0. START    1. CANCEL     2. EXPIRE    3. ACKNOWLEDGE */
      /* -----------      ----------  ---------     ---------    -------------- */
      /* 0. NOSUB     */  [started,    noAction,     noAction,    noAction],              
      /* 1. STARTED   */  [noAction,   cancelled,    expired,     noAction],
      /* 2. CANCELLED */  [started,    noAction,     expired,     noAction],
      /* 3. EXPIRED   */  [started,    noAction,     noAction,    noSub ]
    ]
    
    var oldConfig = {
      isTrial         : this.isTrial(),
      isTrialFinished : this.isTrialFinished(),
      state           : this.getState(),
      timeStarted     : this.getTimeStarted(),
    }
    
    this.log.fine('oldConfig: ' + JSON.stringify(oldConfig))
    
    // Call the appropriate action function for this state/event combination
    return SUBS_TABLE[oldConfig.state][event.event - EVENT_OFFSET_]()

    // Private Functions
    // -----------------

    /** 
     * Check the parameters
     */
     
    function checkParameters() {
    
      if (typeof event !== 'object') {
        throw new Error('"event" is not an object: ' + event)      
      }
      
      if (!event.hasOwnProperty('event') || !event.hasOwnProperty('isTrial')) {
        throw new Error('"event" does not have the expected properties: ' + JSON.stringify(event))            
      }
  
      if (typeof event.event !== 'number') {
        throw new Error('"event.event" is not a number: ' + event.event)                  
      }
  
      if (typeof event.isTrial !== 'boolean') {
        throw new Error('"event.trial" is not a boolean: ' + event.isTrial)                  
      }
  
      if (event.event < EVENT_OFFSET_) {
        throw new Error('Event value is less than the offset: ' + event)
      }
      
    } // Subs_.processEvent.checkParameters()
    
    /** 
     * No action required for this combo, which we don't expect to see
     */
    
    function noAction() {
    
      log.functionEntryPoint()
      var message = 'Unexpected state/event: ' + oldConfig.state + '/' + event.event 
      log.warning(message)
      return message
      
    } // Subs_.processEvent.noAction()
    
    /**
     * User is starting a new subscription
     */
    
    function started() {

      log.functionEntryPoint()
      
      if (oldConfig.isTrial && oldConfig.isTrialFinished) {
        return 'The user has already had one trial'
      }
      
      var timerStartedAt = (new Date()).getTime()
      
      return updateProperties(event.isTrial, SUBS_STATE.STARTED, timerStartedAt)
    
    } // Subs_.processEvent.started()

    /**
     * User has cancelled their subscription
     */
    
    function cancelled() {

      log.functionEntryPoint()
      return updateProperties(oldConfig.isTrial, SUBS_STATE.CANCELLED, oldConfig.timeStarted)
    
    } // Subs_.processEvent.newSubscription()

    /**
     * The subscription timer has expired
     */
    
    function expired() {

      log.functionEntryPoint()

      // Ensure the user can only use the trial once
      if (oldConfig.isTrial) {
        self.properties.setProperty(PROPERTY_.TRIAL_FINISHED, 'true')
      }
      
      return updateProperties(null, SUBS_STATE.EXPIRED, TIMER_NOT_STARTED_)
    
    } // Subs_.processEvent.expired()

    /**
     * The subscription is finished
     */
    
    function noSub() {

      log.functionEntryPoint()
      return updateProperties(null, SUBS_STATE.NOSUB, null)
    
    } // Subs_.processEvent.expired()

    /**
     * Update the user subscription properties
     *
     * @param {boolean | object} isTrial or null to delete    
     * @param {SUBS_STATE} newState
     * @param {number | object} newTimeStarted or null to delete
     */ 

    function updateProperties(isTrial, newState, newTimeStarted) {
    
      log.functionEntryPoint()
      
      log.fine('isTrial: %s',        isTrial)      
      log.fine('newState: %s',       newState)
      log.fine('newTimeStarted: %s', newTimeStarted)
      
      var properties = self.properties

      // isTrial
      // -------
      
      if (typeof isTrial === 'boolean') {
      
        set(PROPERTY_.TRIAL, isTrial)
        
      } else if (typeof isTrial === 'object') {
        
        if (isTrial === null) {
        
          deleteP(PROPERTY_.TRIAL)     
          
        } else {
         
          error('Trying to set "trial" to bad object')
        }
        
      } else {
      
        error('Trying to set "trial" to bad type')      
      }
      
      // state
      // ------
      
      set(PROPERTY_.STATE, newState)
           
      // Time started
      // ------------
      
      if (typeof newTimeStarted === 'number') {
      
        set(PROPERTY_.TIME_STARTED, newTimeStarted)
      
      } else if (typeof newTimeStarted === 'object') {
        
        if (newTimeStarted === null) {
        
          deleteP(PROPERTY_.TIME_STARTED)      
          
        } else {
        
          error('Trying to set "trial" to bad object')
        }
      }
      
      return ''
      
      // Private Functions
      // -----------------
      
      function set(property, value) {
      
        log.functionEntryPoint()
        properties.setProperty(property, value)
      
      } // Subs_.processEvent.updateProperties.setProperty()

      function deleteP(property) {
      
        log.functionEntryPoint()
        properties.deleteProperty(property)
      
      } // Subs_.processEvent.updateProperties.deleteProperty()

      function error(property) {
      
        log.functionEntryPoint()
        throw new Error(property)
      
      } // Subs_.processEvent.updateProperties.error()
      
    } // Subs_.processEvent.updateProperties()

  } // Subs_.processEvent_()
  
  /**
   * Check if subscription expired - this needs to be automatically 
   * run daily
   */
   
  ns.checkIfExpired = function() {

    checkInitialised(this)
    this.log.functionEntryPoint()
    var properties = this.properties
    
    var state = this.getState()
    var isTrial = this.isTrial()
    
    if (state !== SUBS_STATE.STARTED && state !== SUBS_STATE.CANCELLED) {
      this.log.fine('Ignore this state: ' + state)
      return
    }
    
    var startedString = properties.getProperty(PROPERTY_.TIME_STARTED)
    
    if (startedString === null) {
      throw new Error('User is in a trial, but the trial timer has been cleared')
    }
    
    var started = parseFloat(startedString)
    
    // Test for NaN
    if (started !== started) {
      throw new Error('The trial timer does not contain a number: ' + started)      
    }
    
    this.log.fine('started: ' + started)
    
    if (started === -1) {
      this.log.warning('The "check expired" trigger is running, but the timer is not set')
      return
    }
    
    var today = (new Date()).getTime()
    var totalTime = today - started
    
    if (totalTime < 0) {
      throw new Error('The trial timer was started after today?!: ' + totalTime)      
    }
    
    var subLength = isTrial ? this.trialLength : this.fullLength
    
    if (subLength === null) {
      throw new Error('The subscription time length is not set')
    }
    
    if (totalTime > subLength) {
      this.processEvent({event: SUBS_EVENT.EXPIRE, isTrial: isTrial})
    }
    
  } // Subs_.checkTrialExpired()

  /**
   * Handle an error thrown during subscription
   *
   * @param {string} message
   *
   * @return {Object}
   */
   
   function throwError(message) {
  
// TODO -   
  
    this.log.functionEntryPoint()   
 /*   
    if (config.oldState === SUBS_STATE.SUBSCRIBED && !config.isTrialOld) {
    
      // Leave "subscribed" 
      Subs_.processEvent_(SUBS_STATE.SUBSCRIBED)
      
    } else {
    
       // ??
      Subs_.processEvent(SUBS_STATE.NEW) 
    }

    this.properties.deleteProperty(PROPERTY_.TIME_STARTED)    
*/    
    throw new Error(message)
  
  } // Subs_.throw new Error()

  /**
   * Check that the Subs object has been initialised
   */

  function checkInitialised(config) {
    
    if (config.properties  === null ||
        config.log         === null ||
        config.trialLength === null ||
        config.fullLength  === null) {
        
      throw new Error('The Subs object has not been initialised, call Subs.get() first')
    }
      
  } // Subs_.checkInitialised()

  /**
   * Convert a string into a boolean
   */
   
  function castBoolean(value) {
  
    var bool
    
    if (typeof value !== 'string') {
      throw new Error('"value" is not a string: ' + value)      
    }
    
    if (value === 'true') {     
    
      bool = true
      
    } else if (value === 'false') {
    
      bool = false
      
    } else {
    
      throw new Error('String is not a boolean: ' + value)
    }
  
    return bool
    
  } // Subs_.castBoolean()
   
  return ns

})(Subs_ || {})