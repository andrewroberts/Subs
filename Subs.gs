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
//
// NOTE: This is always used as a library so although it is passed a BBLog
// logging object do not every log anything higher than "fine".

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

// Global Config
// -------------

var SCRIPT_NAME    = "Subs"
var SCRIPT_VERSION = "v0.dev_ajr"

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
  TIMER          : SCRIPT_NAME + '_Timer',          // {number} mS
  TRIAL          : SCRIPT_NAME + '_Trial',          // {string} 'true' or 'false'
  TRIAL_FINISHED : SCRIPT_NAME + '_Trial_Finished', // {string} 'true' or 'false'
  LOCK           : SCRIPT_NAME + '_Lock',           // {string} 'true' or 'false'
})

var TIMER_NOT_STARTED = -1

var MS_PER_DAY_ = 1000 * 60 * 60 * 24

var DEFAULT_TRIAL_LENGTH_IN_MS_ = MS_PER_DAY_ * 15
var DEFAULT_FULL_LENGTH_IN_MS_  = MS_PER_DAY_ * 365

var LOCK_WAIT_ = 1000

// Dummy logging object
var Log_ = {
  functionEntryPoint : function() {},
  finest             : function() {},
  finer              : function() {},
  fine               : function() {},
  info               : function() {},
  warning            : function() {},
}

// User Guide
// ----------

/*

See the script bound to the Subs Test sheet (goo.gl/fb1ZDF) for example on using Subs.

See the user manual (goo.gl/PtdTF9) for more details.

  .
  .
  .
  // Setup: Get a Subs object - See Subs_ description below
  var sub = Subs.get({
    properties  : PropertiesService.getScriptProperties(), 
    log         : BBLog.getLog(),                                     
    trialLength : 7,                                       
    fullLength  : 180,                                     
  })
  .
  .
  .
  // Process the start of a subscription - a START event, e.g. from a web app's UI
  var response = sub.processEvent({event:SUBS_EVENT.START, isTrial: TRIAL_TRUE})
  .
  .
  .
  // Indirectly generate an EXPIRE event by regularly running checkIfExpired() via
  // a daily trigger
  sub.checkIfExpired()
  .
  .
  .
  // Process the user acknowledging the end of the subscription - an ACKNOWLEDGE event
  var response = sub.processEvent({event:SUBS_EVENT.ACKNOWLEDGE})
  .
  .
  .
*/

// Public Code
// -----------

/**
 * The Subs_ config parameter object
 *
 * @typedef {object} SubsEvent
 * @property {SUBS_EVENT} event - The Subs event
 * @property {boolean} isTrial - Whether this an event for a trial or not [OPTIONAL, DEFAULT: false]
 */

/**
 * The Subs_ config event parameter object
 *
 * @typedef {object} SubsGetConfig
 * @property {number} trialLength - The length of a trial in days [OPTIONAL, DEFAULT: 15]
 * @property {number} fullLength - The length of a full subscription in days [OPTIONAL, DEFAULT: 350]
 * @property {PropertiesService} properties - Any service with an API similar to a PropertiesService
 * @property {BBLog} log - A logging service with the same API as BBLog (github.com/andrewroberts/BBLog) [OPTIONAL]
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

  // Public Methods
  // --------------

  /**
   * Reset the internal config
   */
   
  ns.reset = function() {
  
    ns.properties.deleteProperty(PROPERTY_.STATE)
    ns.properties.deleteProperty(PROPERTY_.TIMER)
    ns.properties.deleteProperty(PROPERTY_.TRIAL)
    ns.properties.deleteProperty(PROPERTY_.LOCK)
    ns.properties.deleteProperty(PROPERTY_.TRIAL_FINISHED)
  
  } // Subs_.reset()
  
  /**
   * Private method to get a subscription object
   *
   * @param {SubsGetConfig} config - {@link SubsGetConfig} 
   *
   * @return {Subs_} object 
   */
   
  ns.get = function(config) {

    var self = this

    ns.log = config.log || Log_
    var log = ns.log
    log.functionEntryPoint()
    log.fine('config: ' + JSON.stringify(config))

    checkProperties()
    ns.properties = config.properties
    
    initialiseProperty(PROPERTY_.STATE,          SUBS_STATE.NOSUB)
    initialiseProperty(PROPERTY_.TIMER,          TIMER_NOT_STARTED)
    initialiseProperty(PROPERTY_.TRIAL,          false)
    initialiseProperty(PROPERTY_.LOCK,           false)
    initialiseProperty(PROPERTY_.TRIAL_FINISHED, false)
     
    initialiseSubLength('trialLength', DEFAULT_TRIAL_LENGTH_IN_MS_)
    initialiseSubLength('fullLength',  DEFAULT_FULL_LENGTH_IN_MS_)
     
    return Object.create(this)
    
    // Private Functions
    // -----------------

    /**
     * Check that a properties object has been passed 
     */
     
    function checkProperties() {
    
      log.functionEntryPoint()
  
      if (!config.hasOwnProperty('properties')) {     
        throw new Error('config.properties not defined')
      }
      
    } // Subs_.get.checkProperties()

    /**
     * Intialise the properties that are held externally
     *
     * @param {PROPERTY_} name
     * @param {object} value
     */
     
    function initialiseProperty(name, value) {

      log.functionEntryPoint()

      if (self.properties.getProperty(name) !== null) {
        return
      }

      // Everything is stored in as a string. This mimics PropertiesService 
      // whatever actually is used.
      self.properties.setProperty(name, value.toString())
      log.fine('Set property "' + name + '" to "' + value + '"')

    } // Subs_.get.initialiseProperty()

    /**
     * Initialise the subscription length
     *
     * @param {string} name
     * @param {number} defaultValue
     */
     
    function initialiseSubLength(name, defaultValue) {

      log.functionEntryPoint()

      if (!config.hasOwnProperty(name)) {
      
        self.log.fine('Using default ' + name + ': ' + (defaultValue / MS_PER_DAY_))
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
  
    checkInitialised()
    ns.log.functionEntryPoint()
    
    var state = parseInt(ns.properties.getProperty(PROPERTY_.STATE), 10)
    
    if (state !== state) {  
      throw new Error('Subs state is not a number: ' +  state)
    }
    
    if (state >= Object.keys(SUBS_STATE).length) {
      throw new Error('Subs state is outside expected range: ' +  state)
    }
   
    ns.log.fine('state: ' + state)
    return state
  
  } // Subs_.getState() 
  
  /**
   * @return {boolean} whether this is a trial
   */
     
  ns.isTrial = function() {
  
    checkInitialised()
    ns.log.functionEntryPoint()
    
    var trial = ns.properties.getProperty(PROPERTY_.TRIAL)
    
    if (typeof trial !== 'string') {
      throw new Error('non string value stored for "isTrial"')
    }

    trial = castBoolean(trial)
    ns.log.fine('isTrial: ' + trial + ' (' + typeof trial + ')')
    return trial
  
  } // Subs_.isTrial() 

  /**
   * @return {boolean} Whether the user has already has a trial
   */

  ns.isTrialFinished = function() {
  
    checkInitialised()  
    ns.log.functionEntryPoint()
    var trialFinished = castBoolean(ns.properties.getProperty(PROPERTY_.TRIAL_FINISHED)) 
    ns.log.fine('trialFinished: ' + trialFinished + ' (' + typeof trialFinished + ')')
    return trialFinished
  
  } // Subs_.isTrialFinished()

  /**
   * Get the time the subscription timer started
   *
   * @return {number} ms since start or -1 if not started
   */
   
  ns.getTimeTimerStarted = function() {
  
    checkInitialised()  
    ns.log.functionEntryPoint()

    var timeStarted = parseFloat(ns.properties.getProperty(PROPERTY_.TIMER))
      
    if (timeStarted !== timeStarted) {       
      throw new Error('Subs time started is not a number: ' +  timeStarted)
    }
    
    return timeStarted
  
  } // Subs_.getTimeTimerStarted() 
  
  /**
   * Process a new "subscription" event 
   *
   * @param {Object} event
   *   {SUBS_EVENT} event
   *   {boolean} isTrial [OPTIONAL, DEFAULT: false]
   *
   * @return {String} errorMessage or ''
   */

  ns.processEvent = function(event) {
  
    checkInitialised()  
    var log = ns.log    
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
    
    if (!getLock()) {
      return ''
    }

    try {

      var oldConfig = {
        isTrial         : event.isTrial || false,
        isTrialFinished : ns.isTrialFinished(),
        state           : ns.getState(),
        timeStarted     : ns.getTimeTimerStarted(),
      }
      
      ns.log.fine('oldConfig: ' + JSON.stringify(oldConfig))
      
      // Call the appropriate action function for this state/event combination
      var message = SUBS_TABLE[oldConfig.state][event.event - EVENT_OFFSET_]()
    
    } finally {
    
      releaseLock()
    }

    return message

    // Private Functions
    // -----------------

    /** 
     * Check the parameters
     */
     
    function checkParameters() {
    
      if (typeof event !== 'object') {
        throw new Error('"event" is not an object: ' + event)      
      }
      
      if (!event.hasOwnProperty('event')) {
        throw new Error('"event" does not have the expected properties: ' + JSON.stringify(event))            
      }
  
      if (typeof event.event !== 'number') {
        throw new Error('"event.event" is not a number: ' + event.event)                  
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
      return ''
      
    } // Subs_.processEvent.noAction()
    
    /**
     * User is starting a new subscription
     */
    
    function started() {

      log.functionEntryPoint()
      var message
      
      if (oldConfig.isTrial && oldConfig.isTrialFinished) {
      
        message = 'The user has already had one trial'
         
      } else {
      
        var datetime
      
        if (oldConfig.state === SUBS_STATE.NOSUB || oldConfig.state === SUBS_STATE.EXPIRED) { 
      
          // Restart timer
          datetime = (new Date()).getTime()
          
        } else {
      
          if (oldConfig.timeStarted !== -1) {
      
            // Keep running with the original timer
            datetime = oldConfig.timeStarted
            
          } else {
          
            throw new Error('State is ' + oldConfig.state + ' but the timer has not been started')
          }
        }
        
        message = updateProperties(oldConfig.isTrial, SUBS_STATE.STARTED, datetime)
      }
      
      return message
    
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
      
      return updateProperties(false, SUBS_STATE.EXPIRED, TIMER_NOT_STARTED)
    
    } // Subs_.processEvent.expired()

    /**
     * The subscription is finished
     */
    
    function noSub() {

      log.functionEntryPoint()
      return updateProperties(false, SUBS_STATE.NOSUB, TIMER_NOT_STARTED)
    
    } // Subs_.processEvent.expired()

    /**
     * Update the user subscription properties
     *
     * @param {boolean | object} isTrial or null to delete    
     * @param {SUBS_STATE} state
     * @param {number | object} newTimeStarted or null to delete
     */ 

    function updateProperties(isTrial, state, timeStarted) {
    
      log.functionEntryPoint()
      
      log.fine('isTrial: %s',        isTrial)      
      log.fine('newState: %s',       state)
      log.fine('newTimeStarted: %s', timeStarted)
      
      var properties = self.properties

      set(PROPERTY_.TRIAL, isTrial)
      set(PROPERTY_.STATE, state)
      set(PROPERTY_.TIMER, timeStarted)
      
      return ''
      
      // Private Functions
      // -----------------

      /**
       * Set a property
       *
       * @param {PROPERTY_} property
       * @param {object} value
       */

      function set(property, value) {
      
        log.functionEntryPoint()
        properties.setProperty(property, value)
      
      } // Subs_.processEvent.updateProperties.setProperty()

    } // Subs_.processEvent.updateProperties()

  } // Subs_.processEvent_()
  
  /**
   * Check if subscription expired - this needs to be automatically 
   * run daily. If a subscription has expired an EXPIRE event will 
   * be generated.
   */
   
  ns.checkIfExpired = function() {

    checkInitialised()
    ns.log.functionEntryPoint()
    var properties = ns.properties
    
    var state = ns.getState()
    var isTrial = ns.isTrial()
    
    if (state !== SUBS_STATE.STARTED && state !== SUBS_STATE.CANCELLED) {
      ns.log.fine('Ignore this state: ' + state)
      return
    }
   
    var started = getStartedTime()
       
    if (started === TIMER_NOT_STARTED) {
      ns.log.warning('The "check expired" trigger is running, but the timer is not set')
      return
    }
    
    var today = (new Date()).getTime()
    var totalTime = today - started
    
    if (totalTime < 0) {
      throw new Error('The trial timer was started after today?!: ' + totalTime)      
    }
    
    var subLength = isTrial ? ns.trialLength : ns.fullLength
    
    if (subLength === null) {
      throw new Error('The subscription time length is not set')
    }
    
    if (totalTime > subLength) {
      ns.processEvent({event: SUBS_EVENT.EXPIRE, isTrial: ns.isTrial()})
    }
    
  } // Subs_.checkTrialExpired()

  /**
   * @return {number} the number of days left in the subscription
   */
  
  ns.getSubscriptionLeft = function() {

    checkInitialised()
    ns.log.functionEntryPoint()
    
    var subscriptionStartedInMs = getStartedTime()
    
    if (subscriptionStartedInMs === TIMER_NOT_STARTED) {
      return 0
    }
    
    var todayInMs = (new Date()).getTime()
    var timeRunningMs = todayInMs - subscriptionStartedInMs
    ns.log.fine('timeRunningMs: ' + timeRunningMs)
    
    var totalSubscriptionLengthInMs = DEFAULT_FULL_LENGTH_IN_MS_

    if (ns.isTrial()) {
      totalSubscriptionLengthInMs = DEFAULT_TRIAL_LENGTH_IN_MS_
    }
    
    if (timeRunningMs > totalSubscriptionLengthInMs) {
      ns.processEvent({event: SUBS_EVENT.EXPIRE, isTrial: ns.isTrial()})
      return 0
    }
    
    ns.log.fine('totalSubscriptionLengthInMs: ' + totalSubscriptionLengthInMs)
    
    var timeLeftInDays = Math.round((totalSubscriptionLengthInMs - timeRunningMs) / MS_PER_DAY_)
    ns.log.fine('timeLeftInDays: ' + timeLeftInDays)
    return timeLeftInDays
     
  } // Subs_.getSubscriptionLeft()

  // Private Functions
  // -----------------

  /**
   * Check that the Subs object has been initialised
   */

  function checkInitialised() {

    ns.log.functionEntryPoint()   

    if (ns.properties  === null ||
        ns.log         === null ||
        ns.trialLength === null ||
        ns.fullLength  === null) {
        
      throw new Error('The Subs object has not been initialised, call Subs.get() first')
    }
      
  } // Subs_.checkInitialised()

  /**
   * Convert a string into a boolean
   */
   
  function castBoolean(value) {

    ns.log.functionEntryPoint()   

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
  
  /**
   * Get the lock
   *
   * @return {boolean} Whether lock has been got
   */
  
  function getLock() {
  
    ns.log.functionEntryPoint()   

    var locked = ns.properties.getProperty(PROPERTY_.LOCK)
    var gotLock
    
    if (locked === 'true') {
    
      ns.log.fine('Having to wait for lock')
      Utilities.sleep(LOCK_WAIT_)
      locked = ns.properties.getProperty(PROPERTY_.LOCK)
      
      if (locked === 'true') {  
      
        ns.log.warning('Failed to get lock')
        gotLock = false
        
      } else if (locked === 'false') {

        ns.log.fine('Got lock')
        gotLock = true
        
      } else {
      
        throw new Error('Lock property does not contain "true" or "false"')
      }
      
    } else if (locked === 'false') {

      ns.log.fine('Got lock')
      ns.properties.setProperty(PROPERTY_.LOCK, 'true')
      gotLock = true
          
    } else {
    
      throw new Error('Lock property does not contain "true" or "false"')
    }
      
    return gotLock
      
  } // Subs_.getLock()

  /**
   * Release the lock
   */
  
  function releaseLock() {
  
    ns.log.functionEntryPoint()   

    var locked = ns.properties.getProperty(PROPERTY_.LOCK)
    
    if (locked === 'true') {
    
      ns.properties.setProperty(PROPERTY_.LOCK, 'false')
      ns.log.fine('Released lock')
            
    } else if (locked === 'false') {

      ns.log.warning('Lock already released')
      
    } else {
    
      throw new Error('Lock property does not contain "true" or "false"')
    }

  } // Subs_.releaseLock()

  /**
   * Get when the subscription timer started in ms from epoch
   */
  
  function getStartedTime() {

    ns.log.functionEntryPoint()   

    var startedString = ns.properties.getProperty(PROPERTY_.TIMER)    
    var started = parseFloat(startedString)
    
    if (started !== started) {
      throw new Error('The trial timer does not contain a number: ' + started)      
    }
    
    ns.log.fine('started: ' + started)
    
    return started

  } // Subs_.getStartedTime()

  return ns

})(Subs_ || {})