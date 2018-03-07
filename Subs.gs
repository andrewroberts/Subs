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

 - Set PROPERTY_TRIAL_LENGTH_ & PROPERTY_FULL_LENGTH_
 - Test trial expiration
 - Test trying to get two trials
 - Think about which situations warrant throwing an error, and which passing an
   error message back to the user.
 - Check for error message in tests
 - Stop user from being able to subscribe for another trial
 - What state to leave in after an error??
 - What happens to the timer if a sub is cancelled - 
 - Add "trial finished" to updateProperties()

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

var EVENT_OFFSET_ = 100

var SUBS_EVENT = Object.freeze({
  START:       EVENT_OFFSET_ + 0, // User started subscription - trial or full
  CANCEL:      EVENT_OFFSET_ + 1, // User cancelled subscription
  EXPIRE:      EVENT_OFFSET_ + 2, // Subscription expired
  ACKNOWLEDGE: EVENT_OFFSET_ + 3, // User acknoledged subscription end
})

// Private Config
// --------------

var PROPERTY_STATE_          = SCRIPT_NAME + '_State'         // String SUBS_STATE
var PROPERTY_TIME_STARTED_   = SCRIPT_NAME + '_Time_Started'  // Number mS
var PROPERTY_TRIAL_          = SCRIPT_NAME + '_Trial'         // boolean
var PROPERTY_TRIAL_FINISHED_ = SCRIPT_NAME + '_Trial_Finished' // 'true' or not-set (null)

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
  
    if (!config.hasOwnProperty('properties')) {
      this.throwError('config.properties not defined')
    }
     
    var newSub = Object.create(this)
    
    this.properties = config.properties
    
    this.log = config.log || Log_
    
    if (!config.hasOwnProperty('trialLength')) {
      this.log.warning('Using default trial length: ' + (DEFAULT_TRIAL_LENGTH_ / MS_PER_DAY_))
      this.trialLength = DEFAULT_TRIAL_LENGTH_
    } else {
      this.trialLength = config.trialLength
    }

    if (!config.hasOwnProperty('fullLength')) {
      this.log.warning('Using default full length: ' + (DEFAULT_FULL_LENGTH_ / MS_PER_DAY_))
      this.fullLength = DEFAULT_FULL_LENGTH_
    } else {
      this.fullLength = config.trialLength
    }
    
    return newSub
    
  } // Subs_.get

  /**
   * Get User subscription status
   *
   * @return {SUBS_STATE} status
   */
   
  ns.getState = function() {
  
    this.log.functionEntryPoint()
    
    var state = this.properties.getProperty(PROPERTY_STATE_)
    
    if (state === null) {
    
      state = SUBS_STATE.NOSUB
      
    } else {
    
      var stateNumber = parseInt(state, 10)
      
      if (stateNumber !== stateNumber) { // Test for NaN
      
        this.throwError('Subs state is corrupt: ' +  state)
        
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
   * @return {boolean | object} is this a trial or not or {Object} null
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
      
        this.throwError('Corrupt "trial": ' + trial)
      }
    }
    
    return trial
  
  } // Subs_.isTrial() 

  /**
   * @return {boolean} Whether the trial has finished
   */

  ns.isTrialFinished = function() {
  
    this.log.functionEntryPoint()
    var trialFinished = this.properties.getProperty(PROPERTY_TRIAL_FINISHED_)
    return (trialFinished === 'true') ? true : false
  
  } // Subs_.isTrialFinished()


  /**
   * Get the time the subscription timer started
   *
   * @return {Number} ms since start or {Object} null
   */
   
  ns.getTimeStarted = function() {
  
    this.log.functionEntryPoint()

    var timeStarted = this.properties.getProperty(PROPERTY_TIME_STARTED_)
    
    if (timeStarted !== null) {
    
      var timeStartedNumber = parseInt(timeStarted, 10)
      
      if (timeStartedNumber !== timeStartedNumber) { // Test for NaN
      
        this.throwError('Subs time started is corrupt: ' +  timeStarted)
        
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
   *   {boolean} trial
   *
   * @return {String} errorMessage or ''
   */

  ns.processEvent = function(event) {
  
    var log = this.log
    log.functionEntryPoint()
    log.fine('event: ' + JSON.stringify(event))
    
    if (event < EVENT_OFFSET_) {
      this.throwError('Bad event value')
    }
    
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
    var errorMessage = SUBS_TABLE[config.oldState][event.event - EVENT_OFFSET_](config)
    
    return errorMessage

    // Private Functions
    // -----------------

    function noAction(config) {
    
      log.functionEntryPoint()
      var message = 'Unexpected state (' + config.oldState + ')/Event(' + event.event + ')' 
      log.warning(message)
      return message
      
    } // Subs_.processEvent.noAction()
    
    /**
     * User is starting a new subscription
     */
    
    function started(config) {

      log.functionEntryPoint()
      
      var trialFinished = self.isTrialFinished()
      
      if (config.oldTrial && trialFinished) {
        return 'The user has already had one trial'
      }
      
      var timerStartedAt = (new Date()).getTime()
      
      return updateProperties(event.trial, SUBS_STATE.STARTED, timerStartedAt)
    
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
      self.properties.setProperty(PROPERTY_TRIAL_FINISHED_, 'true')
      
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
     * @param {boolean | object} trial or null to delete    
     * @param {SUBS_STATE} status
     * @param {number | object} timeStarted or null to delete
     */ 

    function updateProperties(newTrial, newState, newTimeStarted, trialFinished) {
    
      log.functionEntryPoint()
      
      log.fine('newTrial: %s', newTrial)      
      log.fine('newState: %s', newState)
      log.fine('newTimeStarted: %s', newTimeStarted)
      log.fine('trialFinished: %s', trialFinished)
      
      var properties = self.properties

      // Status
      // ------
      
      set(PROPERTY_STATE_, newState)
      
      // isTrial
      // -------
      
      if (typeof newTrial === 'boolean') {
      
        set(PROPERTY_TRIAL_, newTrial)
        
      } else if (typeof newTrial === 'object') {
        
        if (newTrial === null) {
        
          deleteP(PROPERTY_TRIAL_)     
          
        } else {
         
          error('Trying to set "trial" to bad object')
        }
        
      } else {
      
        error('Trying to set "trial" to bad type')      
      }
      
      // Trial finished
      // --------------

      if (trialFinished) {
        set(PROPERTY_TRIAL_FINISHED_, 'true') 
      }
      
      // Time started
      // ------------
      
      if (typeof newTimeStarted === 'number') {
      
        set(PROPERTY_TIME_STARTED_, newTimeStarted)
      
      } else if (typeof newTimeStarted === 'object') {
        
        if (newTimeStarted === null) {
        
          deleteP(PROPERTY_TIME_STARTED_)      
          
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
        self.throwError(property)
      
      } // Subs_.processEvent.updateProperties.error()
      
    } // Subs_.processEvent.updateProperties()

  } // Subs_.processEvent_()
  
  /**
   * Check if subscription expired - this needs to be automatically 
   * run daily
   */
   
  ns.checkIfExpired = function() {
  
    this.log.functionEntryPoint()
    var properties = this.properties
    
    var status = this.getState()
    var inTrial = this.isTrial()
    
    if (status !== SUBS_STATE.STARTED && status !== SUBS_STATE.CANCELLED) {
      this.log.fine('Ignore this state: ' + status)
      return
    }
    
    var startedString = properties.getProperty(PROPERTY_TIME_STARTED_)
    
    if (startedString === null) {
      this.throwError('User is in a trial, but the trial timer has been cleared')
    }
    
    var started = parseFloat(startedString, 10)
    
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
      
      subLength = this.trialLength
      
    } else {
      
      subLength = properties.fullLength
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
      this.processEvent({event: SUBS_EVENT.EXPIRE, trial: inTrial})
    }
    
  } // Subs_.checkTrialExpired()

  /**
   * Handle an error thrown during subscription
   *
   * @param {string} message
   *
   * @return {Object}
   */
   
  ns.throwError = function handleError(message) {
  
// TODO -   
  
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