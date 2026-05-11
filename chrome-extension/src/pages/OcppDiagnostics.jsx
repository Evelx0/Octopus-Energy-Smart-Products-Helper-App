import { useState } from 'react';
import { Link } from 'react-router-dom';
import RefTabs from '../components/ui/RefTabs';

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'compat',   label: 'Compatibility' },
  { id: 'decoder',  label: 'Diagnostics Decoder' },
];

// ─── Diagnostics data ─────────────────────────────────────────────────────────
// All content sourced from OCPP 2.1 Edition 2 spec (internal-webapp/docs/).
// DO NOT import docs/ at runtime — this constant is the intended pattern.
const DIAGNOSTIC_CATEGORIES = [
  {
    id: 'charging-states',
    label: 'Charging States',
    field: 'transactionInfo.chargingState',
    description: 'The current state of the charging session — what the charger and car are doing right now.',
    entries: [
      {
        code: 'Idle',
        label: 'Charger waiting — nothing plugged in',
        eli5: 'The charger is powered on and ready, but no car is connected. It\'s sitting idle, waiting for a vehicle to plug in. This is the normal resting state.',
      },
      {
        code: 'EVConnected',
        label: 'Car plugged in — not yet charging',
        eli5: 'A car has been physically plugged into the charger, but the charging session hasn\'t started yet. This happens briefly while the charger and car negotiate how to charge, or while waiting for authorisation (RFID, app command, or smart schedule).',
      },
      {
        code: 'Charging',
        label: 'Power flowing to the car',
        eli5: 'The session is active and electricity is actually being transferred to the car\'s battery. This is the expected state during a normal charge.',
      },
      {
        code: 'SuspendedEV',
        label: 'Paused by the car — charger is ready',
        eli5: 'The charger is ready and offering power, but the car has put the session on hold from its end. This is very common and is not a fault — the car\'s battery management system (BMS) may be balancing cells, managing heat, or the car has hit a temporary state-of-charge target. The car will resume automatically when it\'s ready.',
      },
      {
        code: 'SuspendedEVSE',
        label: 'Paused by the charger — car would accept power',
        eli5: 'The car would happily take power, but the charger has paused the session. Common reasons: the Intelligent Octopus smart schedule is holding the session until the cheap overnight window, a grid operator limit is in effect, or the Octopus platform has remotely throttled the charge. This is expected behaviour on IO Go during the day.',
      },
    ],
  },
  {
    id: 'connector-status',
    label: 'Connector Status',
    field: 'StatusNotification.connectorStatus',
    description: 'The physical availability state of a connector or EVSE, reported via StatusNotification messages.',
    entries: [
      {
        code: 'Available',
        label: 'Ready to charge — nothing plugged in',
        eli5: 'The connector is working normally and nothing is plugged in. Any authorised customer could start a session right now.',
      },
      {
        code: 'Occupied',
        label: 'Session in progress',
        eli5: 'A car is plugged in and a session is active (even if currently paused). The connector is in use.',
      },
      {
        code: 'Reserved',
        label: 'Booked — not yet started',
        eli5: 'Someone has reserved this connector for an upcoming session, but the car isn\'t plugged in yet. Only the person who made the reservation can start a session on it.',
      },
      {
        code: 'Unavailable',
        label: 'Taken offline by operator',
        eli5: 'The charger or connector has been deliberately taken out of service — usually for a firmware update, scheduled maintenance, or a configuration change. It will come back online once the operation is complete.',
      },
      {
        code: 'Faulted',
        label: 'Fault detected — needs attention',
        eli5: 'The charger has detected a hardware or software problem and has put itself into a safe fault state. The customer won\'t be able to charge until the fault is resolved. This could be anything from a cable issue to an internal hardware fault — check the charger\'s own diagnostics log for the specific error.',
      },
    ],
  },
  {
    id: 'stop-reasons',
    label: 'Session Stop Reasons',
    field: 'transactionInfo.stoppedReason',
    description: 'Why a charging session ended. Appears in TransactionEvent messages when eventType is Ended.',
    entries: [
      {
        code: 'Remote',
        label: 'Stopped remotely by Octopus / the app',
        eli5: 'The session was ended by a remote command — usually the Octopus platform, the customer\'s app, or an operator action. This is a normal, expected stop.',
      },
      {
        code: 'Local',
        label: 'Stopped locally at the charger',
        eli5: 'Someone physically pressed the stop button on the charger, or tapped an RFID card to end the session at the unit itself. Normal user-initiated stop.',
      },
      {
        code: 'EVDisconnected',
        label: 'Cable unplugged',
        eli5: 'The charging cable was physically removed while a session was in progress. Can be normal (customer finished and unplugged) or unexpected (cable pulled without stopping the session first).',
      },
      {
        code: 'DeAuthorized',
        label: 'Authorisation revoked mid-session',
        eli5: 'The session was running but the token that started it has been invalidated — for example, the customer\'s account was suspended, a prepay balance ran out, or the authorisation expired. The charger stopped the session because it can no longer confirm the customer is entitled to charge.',
      },
      {
        code: 'StoppedByEV',
        label: 'Car requested the session to stop',
        eli5: 'The vehicle itself sent a stop request to the charger, usually because the battery is full or the car\'s charging management system decided it had received enough energy. Completely normal — the car is done.',
      },
      {
        code: 'SOCLimitReached',
        label: 'State-of-charge target hit',
        eli5: 'The car\'s battery has reached the maximum state of charge that was set for this session (e.g. 80% if the customer set an 80% target in the Octopus app). The charger stopped automatically as instructed.',
      },
      {
        code: 'TimeLimitReached',
        label: 'Session time limit reached',
        eli5: 'A maximum session duration was set and the clock ran out. Less common on home chargers but can appear on commercial or shared installations where session time limits are enforced.',
      },
      {
        code: 'EmergencyStop',
        label: 'Emergency stop button pressed',
        eli5: 'The physical emergency stop (e-stop) on the charger was activated. The session is cut immediately for safety. The charger will not restart until it has been physically reset and inspected.',
      },
      {
        code: 'GroundFault',
        label: 'Earth/ground fault detected',
        eli5: 'The charger\'s residual current device (RCD) detected an earth fault — current is leaking somewhere it shouldn\'t be. This is a safety shutdown. The installation should be inspected by a qualified electrician before the charger is used again.',
      },
      {
        code: 'OvercurrentFault',
        label: 'Overcurrent protection triggered',
        eli5: 'More current was flowing than the circuit is rated for, and the charger\'s overcurrent protection tripped. Could indicate a fault in the charger, the cable, or an issue with the premises wiring.',
      },
      {
        code: 'PowerLoss',
        label: 'Mains power was lost',
        eli5: 'The incoming electricity supply to the charger was interrupted — either a power cut, a blown fuse, or a tripped breaker in the property\'s consumer unit. The session ended because there was no power to deliver.',
      },
      {
        code: 'Reboot',
        label: 'Charger rebooted during the session',
        eli5: 'The charger restarted while a session was active. This might be a firmware update completing, a watchdog recovery, or a manual reset by the customer or an engineer.',
      },
      {
        code: 'ImmediateReset',
        label: 'Hard reset command received',
        eli5: 'The Octopus platform or an operator sent an immediate reset command to the charger. The session was terminated abruptly as part of that reset.',
      },
      {
        code: 'PowerQuality',
        label: 'Poor power quality detected',
        eli5: 'The incoming mains supply had quality issues — voltage too low or high, frequency out of range, or excessive fluctuation. The charger stopped to protect both itself and the car\'s battery.',
      },
    ],
  },
  {
    id: 'trigger-reasons',
    label: 'Trigger Reasons',
    field: 'TransactionEvent.triggerReason',
    description: 'What caused a TransactionEvent message to be sent — the reason something notable happened in the session.',
    entries: [
      {
        code: 'Authorized',
        label: 'Token accepted — session authorised',
        eli5: 'An authorisation token (RFID, app, ISO 15118 Plug & Charge) was accepted and the session is starting. This is the normal trigger at the beginning of a charge.',
      },
      {
        code: 'CablePluggedIn',
        label: 'Charging cable physically connected',
        eli5: 'The cable was inserted into the connector. Sent at the very start of the interaction, before authorisation happens.',
      },
      {
        code: 'EVConnected',
        label: 'Car communication established',
        eli5: 'The charger has made communication contact with the car — the EV\'s on-board charger has responded on the control pilot signal. A step beyond cable connection.',
      },
      {
        code: 'ChargingRateChanged',
        label: 'Charging power level changed',
        eli5: 'The rate at which the car is charging has changed — usually because the Intelligent Octopus smart schedule has adjusted the power level, or a grid limit has been applied or lifted.',
      },
      {
        code: 'ChargingStateChanged',
        label: 'Session state transitioned',
        eli5: 'The charging state moved from one value to another (e.g. Charging → SuspendedEVSE). Sent to keep the Octopus platform informed of the current session status.',
      },
      {
        code: 'RemoteStart',
        label: 'Session started remotely',
        eli5: 'The Octopus platform or the customer\'s app sent a command to start the session. Common with Intelligent Octopus when the smart schedule kicks in overnight.',
      },
      {
        code: 'RemoteStop',
        label: 'Session stopped remotely',
        eli5: 'The Octopus platform or the customer\'s app sent a stop command. Normal for smart-schedule-managed sessions.',
      },
      {
        code: 'SoCLimitReached',
        label: 'State-of-charge target hit',
        eli5: 'The car has reached the SoC (battery %) limit that was set for this session. Sent to notify the platform that the target has been achieved.',
      },
      {
        code: 'EVDeparted',
        label: 'Car unplugged / departed',
        eli5: 'The car has been disconnected from the charger. Session will end or has already ended.',
      },
      {
        code: 'LimitSet',
        label: 'A power or energy limit was applied',
        eli5: 'A charging profile limit has been set on this session — for example, the Octopus platform setting a maximum power level, or a grid operator imposing a demand limit.',
      },
      {
        code: 'Deauthorized',
        label: 'Authorisation for the session was revoked',
        eli5: 'The token that authorised the session has been invalidated while the session was running. The charger will stop.',
      },
      {
        code: 'EVCommunicationLost',
        label: 'Communication with the car dropped',
        eli5: 'The charger lost its communication link with the car (control pilot signal lost). This can happen due to a cable fault, a car-side issue, or interference. The charger will typically try to recover.',
      },
    ],
  },
  {
    id: 'operation-modes',
    label: 'Smart Charging Modes',
    field: 'transactionInfo.operationMode',
    description: 'How the charging power is being controlled during a session. Central to how Intelligent Octopus Go manages energy.',
    entries: [
      {
        code: 'Idle',
        label: 'No session active',
        eli5: 'The charger is not in an active session — no operation mode applies.',
      },
      {
        code: 'ChargingOnly',
        label: 'Standard uncontrolled charging',
        eli5: 'The car is charging at full available power with no smart schedule or external control applied. This is what a "dumb" charger always does — IO Go would only show this if the smart schedule hasn\'t taken effect yet, or the customer has requested an override.',
      },
      {
        code: 'CentralSetpoint',
        label: 'Octopus is controlling the exact power level',
        eli5: 'This is the core Intelligent Octopus Go mode. The Octopus platform (CSMS) is sending precise power setpoints to the charger — telling it exactly how many watts to deliver at any given moment. This is how IO Go optimises charging around cheap overnight rates.',
      },
      {
        code: 'ExternalSetpoint',
        label: 'External system (EMS/DSO) controlling power',
        eli5: 'A third-party Energy Management System or Distribution System Operator is controlling the charging power directly. Less common for residential IO Go customers — more relevant for commercial or V2G-enabled installations.',
      },
      {
        code: 'ExternalLimits',
        label: 'External power bounds applied',
        eli5: 'An external system has set upper and/or lower power limits, but isn\'t controlling the exact setpoint. The charger operates within those bounds. Could appear when a grid operator imposes demand limits.',
      },
      {
        code: 'LocalFrequency',
        label: 'Charger responding to grid frequency',
        eli5: 'The charger is automatically adjusting its power draw based on grid frequency — charging less when frequency drops (grid under stress) and more when frequency rises. This is a grid services / demand-side response feature.',
      },
      {
        code: 'LocalLoadBalancing',
        label: 'Load sharing across multiple chargers on site',
        eli5: 'Multiple chargers are sharing the available site capacity between them. If total demand is approaching the site fuse limit, chargers will reduce their individual rates so all sessions can continue safely.',
      },
    ],
  },
  {
    id: 'error-codes',
    label: 'Error & Reason Codes',
    field: 'reason (various response messages)',
    description: 'Error or rejection codes returned in OCPP response messages when a request cannot be fulfilled.',
    entries: [
      {
        code: 'DuplicateProfile',
        label: 'That charging schedule already exists',
        eli5: 'The Octopus platform tried to push a charging profile to the charger, but a profile with the same stack level already exists on the same EVSE. The charger rejected it to avoid conflicting schedules. The platform should clear the existing profile first.',
      },
      {
        code: 'InvalidProfile',
        label: 'The charging schedule data is malformed',
        eli5: 'The charging profile sent by Octopus contained invalid data — perhaps a field was missing, had a wrong type, or the values were logically inconsistent. The charger couldn\'t apply it.',
      },
      {
        code: 'InvalidSchedule',
        label: 'The schedule timing is invalid',
        eli5: 'The time windows in the charging schedule didn\'t make sense — for example, overlapping periods, a start time in the past, or a duration that exceeds allowed limits.',
      },
      {
        code: 'InvalidStackLevel',
        label: 'Profile priority level is invalid',
        eli5: 'Charging profiles have a stack level (priority number). The charger rejected this one because the stack level value was out of the allowed range.',
      },
      {
        code: 'TxInProgress',
        label: 'Can\'t do that while a session is active',
        eli5: 'The charger rejected the request because a charging session is currently running and the requested operation isn\'t allowed mid-session. For example, some configuration changes require no active session.',
      },
      {
        code: 'TxNotFound',
        label: 'Session ID doesn\'t exist',
        eli5: 'The Octopus platform referenced a transaction ID that the charger doesn\'t know about. The session may have ended, the charger may have rebooted, or there\'s a synchronisation issue.',
      },
      {
        code: 'InvalidIdToken',
        label: 'Authorisation token not recognised',
        eli5: 'The RFID card, app token, or ISO 15118 ID presented for authorisation was not accepted. Could be an unknown card, an expired token, or a token for a different account.',
      },
      {
        code: 'CSNotAccepted',
        label: 'Charger not yet registered with the network',
        eli5: 'The charger sent a BootNotification but the Octopus platform hasn\'t accepted it yet. The charger is essentially in a "pending approval" state and can\'t process requests until the boot is acknowledged.',
      },
      {
        code: 'InternalError',
        label: 'Software error inside the charger',
        eli5: 'Something went wrong inside the charger\'s own firmware — an unhandled exception or unexpected state. The request couldn\'t be completed. Usually self-resolves on reboot; persistent occurrences suggest a firmware issue.',
      },
      {
        code: 'OutOfMemory',
        label: 'Charger memory is full',
        eli5: 'The charger\'s internal flash or RAM is exhausted. It can\'t store new charging profiles, log entries, or configuration data. A reboot often frees up RAM; persistent storage issues need a firmware or factory reset.',
      },
      {
        code: 'RateLimitExceeded',
        label: 'Too many schedule updates sent too quickly',
        eli5: 'The Octopus platform sent charging profile updates faster than the charger can handle. The charger rejected the excess requests. The platform should back off and retry.',
      },
      {
        code: 'NoFreqWattCurve',
        label: 'Missing frequency-watt curve for grid response',
        eli5: 'The charger was asked to operate in frequency response mode, but no frequency-watt curve has been configured telling it how to respond to frequency deviations. The profile can\'t be applied.',
      },
      {
        code: 'MissingParam',
        label: 'Required field missing from the request',
        eli5: 'A required parameter wasn\'t included in the message the platform sent. The charger can\'t process an incomplete request.',
      },
      {
        code: 'ValueOutOfRange',
        label: 'A value exceeded allowed limits',
        eli5: 'A field in the request contained a number that falls outside the allowed range — for example, a power setpoint higher than the charger\'s maximum rated output, or a negative time interval.',
      },
    ],
  },
  {
    id: 'auth-tokens',
    label: 'Auth Token Types',
    field: 'idToken.type',
    description: 'How a session was authorised — the type of credential used to start or validate a charge.',
    entries: [
      {
        code: 'ISO14443',
        label: 'Standard RFID card',
        eli5: 'A physical RFID card was used — the type most people tap on a charger. ISO 14443 covers the most common contactless cards (Mifare, etc.). The UID is 4 or 7 bytes in hex.',
      },
      {
        code: 'ISO15693',
        label: 'Long-range RFID tag',
        eli5: 'A less common RFID format — longer read range than ISO 14443. Used on some older or industrial charging installations.',
      },
      {
        code: 'eMAID',
        label: 'ISO 15118 Plug & Charge ID',
        eli5: 'The car authenticated itself automatically using a digital certificate embedded in the vehicle — no card or phone needed. The customer just plugs in and charging starts. This is called Plug & Charge (ISO 15118). The eMAID is the car\'s Electro-Mobility Account Identifier.',
      },
      {
        code: 'EVCCID',
        label: 'Car\'s built-in controller ID (ISO 15118)',
        eli5: 'Similar to eMAID — identifies the car\'s EV Communication Controller. Used in ISO 15118-2 (MAC address format) and ISO 15118-20 (up to 255 characters). Part of the Plug & Charge ecosystem.',
      },
      {
        code: 'MacAddress',
        label: 'Car\'s MAC address (Autocharge)',
        eli5: 'The car\'s network MAC address is used as an identifier — a simpler form of automatic authorisation called Autocharge (not the same as ISO 15118 Plug & Charge). The charger recognises the car by its MAC and starts automatically.',
      },
      {
        code: 'Central',
        label: 'Server-generated token (app start, SMS)',
        eli5: 'The Octopus platform generated a one-time token to start this session remotely — for example when the customer taps "Start charge" in the app, or when the smart overnight schedule kicks in. The token never exists as a physical card.',
      },
      {
        code: 'NoAuthorization',
        label: 'No auth required — open charger',
        eli5: 'This charger is configured to allow anyone to charge without any authorisation. Common on private home chargers where the owner is the only user. Also used for button-start or key-switch installations.',
      },
      {
        code: 'VIN',
        label: 'Vehicle Identification Number',
        eli5: 'The car\'s 17-character VIN is used to identify and authorise the session. Some systems read the VIN automatically; others require the customer to register it in advance.',
      },
    ],
  },
  {
    id: 'boot-reasons',
    label: 'Boot & Restart Reasons',
    field: 'BootNotification.reason',
    description: 'Why the charger sent a BootNotification — i.e. why it started up or restarted.',
    entries: [
      {
        code: 'PowerUp',
        label: 'Fresh power-on from cold',
        eli5: 'The charger started up because it received mains power for the first time (or after a complete power cut). Normal startup.',
      },
      {
        code: 'RemoteReset',
        label: 'Restarted by Octopus remotely',
        eli5: 'The Octopus platform (or an operator) sent a Reset command and the charger rebooted in response. Often used to apply a configuration change or recover from a stuck state.',
      },
      {
        code: 'LocalReset',
        label: 'Reset triggered locally at the charger',
        eli5: 'Someone pressed a reset button on the charger itself, or triggered a reset via the charger\'s local interface. Physical intervention.',
      },
      {
        code: 'FirmwareUpdate',
        label: 'Rebooted after a firmware update',
        eli5: 'The charger downloaded and applied a firmware update, then rebooted to complete the installation. Expected and normal — the charger should come back online quickly.',
      },
      {
        code: 'ScheduledReset',
        label: 'Planned restart at a pre-set time',
        eli5: 'The charger was configured to restart at a specific time — sometimes used for maintenance windows or to apply pending configuration changes during off-peak hours.',
      },
      {
        code: 'Watchdog',
        label: 'Software watchdog recovered a crash',
        eli5: 'The charger\'s internal software watchdog detected that the main process had stopped responding and forced a reboot to recover. Essentially a self-healing crash recovery. Occasional occurrences are normal; frequent watchdog reboots suggest a firmware bug.',
      },
      {
        code: 'ApplicationReset',
        label: 'Application-level restart (not full power cycle)',
        eli5: 'The charger\'s software restarted without cycling the mains power — a software reboot rather than a hardware one. Often used to apply configuration changes that don\'t require a full power cycle.',
      },
      {
        code: 'Unknown',
        label: 'Restart reason not determined',
        eli5: 'The charger couldn\'t determine why it restarted — possibly because the reason wasn\'t stored before the unexpected shutdown. Can happen after a sudden power loss.',
      },
    ],
  },
  {
    id: 'measurands',
    label: 'Key Measurands',
    field: 'sampledValue.measurand (MeterValues / TransactionEvent)',
    description: 'The specific electrical quantities reported in meter value readings. These appear in telemetry and session data.',
    entries: [
      {
        code: 'SoC',
        label: 'State of Charge — battery level (%)',
        eli5: 'The current charge level of the car\'s battery, as a percentage (0–100%). Not all cars report this; depends on car and charger supporting ISO 15118 or CHAdeMO communication.',
      },
      {
        code: 'Energy.Active.Import.Register',
        label: 'Total energy taken from grid (kWh, cumulative)',
        eli5: 'The running total of electricity the charger has drawn from the grid since it was installed (or since its meter was last reset). Like an odometer — always going up. Used for billing and reporting.',
      },
      {
        code: 'Energy.Active.Import.Interval',
        label: 'Energy taken from grid in this interval (kWh)',
        eli5: 'How much electricity was drawn during a specific measurement period (e.g. the last 30 minutes). Useful for time-of-use analysis and smart schedule reporting.',
      },
      {
        code: 'Power.Active.Import',
        label: 'Current charging power (W)',
        eli5: 'How much power is being drawn right now, in watts. A typical home 7kW charger will show ~7000W when charging at full rate. If IO Go is throttling the session, this will be lower.',
      },
      {
        code: 'Power.Active.Export',
        label: 'Power being exported back to grid (W) — V2G',
        eli5: 'Power flowing from the car back into the grid. Only relevant for V2G (Vehicle-to-Grid) capable setups. Most current IO Go customers will not see this value.',
      },
      {
        code: 'Current.Import',
        label: 'Current draw from grid (A)',
        eli5: 'The electrical current flowing from the grid to the charger right now, in amps. For a single-phase 7kW charger at 230V, this would be ~30A at full rate.',
      },
      {
        code: 'Current.Offered',
        label: 'Maximum current the charger is offering (A)',
        eli5: 'The maximum current the charger is willing to supply at this moment — set by the charging profile/schedule. The car may draw less than this, but it cannot draw more.',
      },
      {
        code: 'Voltage',
        label: 'Supply voltage (V)',
        eli5: 'The voltage of the electricity being supplied. UK single-phase supply is nominally 230V. Significant deviations (below 216V or above 253V) can indicate a wiring issue.',
      },
      {
        code: 'Frequency',
        label: 'Grid frequency (Hz)',
        eli5: 'The frequency of the AC electricity supply. UK grid is nominally 50 Hz. Deviations outside 49.5–50.5 Hz are worth noting — significant drops indicate grid stress.',
      },
      {
        code: 'Temperature',
        label: 'Component temperature (°C)',
        eli5: 'The temperature of a specific component inside the charger (connector, power electronics, etc.). High temperatures can cause thermal throttling — the charger reduces power to protect itself.',
      },
      {
        code: 'Display.PresentSOC',
        label: 'SoC shown on charger display right now',
        eli5: 'The battery percentage currently being shown on the charger\'s screen or reported for display purposes. Comes from the car via ISO 15118.',
      },
      {
        code: 'Display.TargetSOC',
        label: 'Target battery % the customer set',
        eli5: 'The SoC target the customer (or the Octopus app) has set for this session. The charger will stop — or the smart schedule will complete — once this level is reached.',
      },
      {
        code: 'Display.RemainingTimeToTargetSOC',
        label: 'Estimated time to reach target battery %',
        eli5: 'How long until the car\'s battery is expected to reach the target SoC. The car calculates this estimate and reports it to the charger.',
      },
      {
        code: 'Power.Factor',
        label: 'Power factor — efficiency of energy transfer',
        eli5: 'A measure of how efficiently the electrical power is being used (1.0 = perfect, lower = some wasted as reactive power). Most EV chargers operate close to 1.0. Very low values can indicate a wiring issue.',
      },
      {
        code: 'Energy.Active.Net',
        label: 'Net energy (import minus export, kWh)',
        eli5: 'Total energy imported minus total energy exported. Useful for V2G sessions where the car both charges and discharges.',
      },
    ],
  },
  {
    id: 'security-events',
    label: 'Security Events',
    field: 'SecurityEventNotification.type',
    description: 'Events reported by the charger relating to security, tamper detection, authentication, and system integrity.',
    entries: [
      {
        code: 'StartupOfTheDevice',
        label: 'Charger started up',
        eli5: 'The charger logged that it powered on. This is a standard security audit event — every startup is recorded so there\'s a clear timeline of when the device was operating.',
      },
      {
        code: 'ResetOrReboot',
        label: 'Charger was reset or rebooted',
        eli5: 'A reboot happened. The security log records this to maintain a complete audit trail. Cross-reference with the BootNotification reason code to see why it rebooted.',
      },
      {
        code: 'FirmwareUpdated',
        label: 'Firmware was updated',
        eli5: 'The charger\'s software was successfully updated to a new version. Expected and normal — good to see as it means the charger is being kept up to date.',
      },
      {
        code: 'TamperDetectionActivated',
        label: 'Physical tamper sensor triggered',
        eli5: 'A sensor inside the charger detected that its casing was opened or the unit was disturbed. This is a serious security event — the charger may have been physically interfered with and should be inspected.',
      },
      {
        code: 'MemoryExhaustion',
        label: 'Charger running out of storage or memory',
        eli5: 'The charger\'s internal memory (RAM or flash storage) is critically low. It may start dropping log entries or failing to store charging profiles. Usually resolved by a reboot; persistent issues need investigation.',
      },
      {
        code: 'InvalidFirmwareSignature',
        label: 'A firmware update had an invalid signature',
        eli5: 'Someone attempted to install firmware that didn\'t pass the security signature check — meaning it either wasn\'t produced by the legitimate manufacturer or was tampered with in transit. The charger correctly rejected it.',
      },
      {
        code: 'FailedToAuthenticateAtCsms',
        label: 'Charger couldn\'t authenticate with Octopus servers',
        eli5: 'The charger tried to connect to the Octopus CSMS (back-end platform) but was rejected — possibly because the charger\'s certificate has expired, the credentials are wrong, or the TLS configuration has changed.',
      },
      {
        code: 'ReconfigurationOfSecurityParameters',
        label: 'Security settings were changed',
        eli5: 'A security-related configuration was modified — such as the security profile, cryptographic keys, or TLS settings. Logged so there\'s an audit trail of any changes to the security posture.',
      },
      {
        code: 'InvalidMessages',
        label: 'Invalid or unrecognised messages received',
        eli5: 'The charger received messages that weren\'t valid OCPP or had invalid signatures. Could indicate a misconfigured system sending to the wrong charger, or in rare cases a probing/attack attempt.',
      },
      {
        code: 'MaintenanceLoginAccepted',
        label: 'Local maintenance access was granted',
        eli5: 'Someone logged in to the charger\'s local maintenance interface (typically a technician with direct access to the device). Logged for audit purposes.',
      },
    ],
  },
  {
    id: 'connector-types',
    label: 'Connector Types',
    field: 'Connector.connectorType',
    description: 'The physical socket or plug type on a connector. Prefix c = captive cable, s = socket outlet.',
    entries: [
      {
        code: 'cCCS2',
        label: 'CCS2 — Combined Charging System (captive cable)',
        eli5: 'The standard DC fast charging connector used by most new European EVs. A Type 2 AC connector with two extra DC pins below it. The cable is permanently attached to the charger. Used for rapid/ultra-rapid charging.',
      },
      {
        code: 'sType2',
        label: 'Type 2 socket — standard UK/EU home and AC charger',
        eli5: 'The most common AC charging socket in the UK and Europe. The customer uses their own cable. This is what the vast majority of Intelligent Octopus Go home chargers use. 7-pin round connector.',
      },
      {
        code: 'cType2',
        label: 'Type 2 — captive cable (AC)',
        eli5: 'Same as sType2 electrically, but the cable is permanently attached to the charger rather than being a socket. Common on tethered home chargers where the customer doesn\'t want to manage a loose cable.',
      },
      {
        code: 'cCCS1',
        label: 'CCS1 — Combined Charging System (North American style)',
        eli5: 'The North American variant of CCS DC fast charging — uses a J1772 Type 1 AC connector with DC pins. Less common in the UK but found on some imported vehicles (older US-spec cars).',
      },
      {
        code: 'cNACS',
        label: 'NACS — North American Charging Standard (Tesla-compatible)',
        eli5: 'Tesla\'s connector standard, now adopted by SAE as J3400. Increasingly common as more non-Tesla manufacturers add NACS ports. Handles both AC and DC charging through the same small connector.',
      },
      {
        code: 'cG105',
        label: 'CHAdeMO — older DC fast charging (captive)',
        eli5: 'A DC fast charging standard used primarily by older Nissan (Leaf), Mitsubishi, and some other Japanese EVs. Being phased out in Europe in favour of CCS2, but still found on legacy installations.',
      },
      {
        code: 'cTesla',
        label: 'Tesla proprietary connector (pre-NACS)',
        eli5: 'Tesla\'s original proprietary connector used on older Superchargers and some Tesla wall connectors. Distinct from the new NACS standard. Only compatible with Tesla vehicles without an adapter.',
      },
      {
        code: 'sType3',
        label: 'Type 3 socket — older French/Italian standard',
        eli5: 'An older AC charging socket standard, once common in France and Italy, now largely superseded by Type 2. Rarely seen on new installations but may appear on legacy chargers.',
      },
      {
        code: 'wInductive',
        label: 'Wireless inductive charging',
        eli5: 'Charging without a physical cable — power is transferred wirelessly through electromagnetic induction between a pad on the ground and a receiver on the car. Still rare in residential settings but growing for commercial fleets.',
      },
      {
        code: 'Undetermined',
        label: 'Connector type not yet identified',
        eli5: 'The charger hasn\'t determined what type of connector is attached — often reported briefly before a cable is fully inserted and the system can identify the connector type.',
      },
    ],
  },

  // ── OCPP 2.0.1 + 2.1 Reason Codes (expanded) ─────────────────────────────
  {
    id: 'reason-codes-v2',
    label: 'Response Reason Codes — Full Set',
    field: 'reason (OCPP 2.0.1 + 2.1 response messages)',
    description: 'All standardised reason codes returned when a CSMS request is rejected or encounters an issue. The earlier "Error & Reason Codes" section covers the most common ones; this section is the complete reference.',
    entries: [
      // ── Charging Profiles ──
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'InvalidProfileId',    label: 'Profile ID is in an invalid range',        eli5: 'The charging profile ID sent by the platform is outside the allowed numeric range for this charger.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'NoPhaseForDC',        label: 'Phase selection not applicable for DC',     eli5: 'A phase was specified in the charging profile, but this is a DC EVSE — phase selection only applies to AC charging.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'PhaseConflict',       label: 'Conflicting phase selection between profiles', eli5: 'Two or more applicable charging profiles specify conflicting phase settings, so the charger cannot determine which to use.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'UnsupportedKind',     label: 'Profile kind not supported by this charger', eli5: 'The type of charging profile (Absolute, Relative, Recurring) isn\'t supported by this particular hardware.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'UnsupportedPurpose',  label: 'Profile purpose not supported',             eli5: 'The charging profile purpose (ChargePointMaxProfile, TxDefaultProfile, etc.) is not supported on this device.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'UnsupportedRateUnit', label: 'Charging rate unit not supported',          eli5: 'The profile specified W (watts) or A (amps) as the rate unit, but this charger only supports one of those options.' },
      { versions: ['OCPP2.1'],               code: 'InvalidOperationMode', label: 'Operation mode invalid for this profile purpose', eli5: 'The operationMode in the charging profile is not valid for the given chargingProfilePurpose. OCPP 2.1 only.' },
      { versions: ['OCPP2.1'],               code: 'NoSignalWattCurve',   label: 'Missing signal-watt curve for AFRR response', eli5: 'The charger received an AFRRSignal but no signal-watt curve is configured — it doesn\'t know how to respond to the signal. OCPP 2.1 only.' },
      // ── Charging Station ──
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'FixedCable',          label: 'Connector has a fixed (non-removable) cable', eli5: 'The charger\'s cable cannot be unlocked because it\'s permanently attached. The UnlockConnector command doesn\'t apply.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'NoCable',             label: 'No cable connected right now',              eli5: 'The UnlockConnector request was received but no cable is present to unlock.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'UnknownConnectorId',  label: 'Connector ID not recognised',               eli5: 'The connector or EVSE ID in the request doesn\'t exist on this charger.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'UnknownConnectorType', label: 'Connector type not known',                 eli5: 'The connector type specified in a ReserveNow request isn\'t recognised.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'UnknownEvse',         label: 'EVSE ID not found on this charger',         eli5: 'The EVSE referenced in the request doesn\'t exist. The platform may have the wrong EVSE number configured.' },
      // ── Swap Station (OCPP 2.1 only) ──
      { versions: ['OCPP2.1'], code: 'BatterySoHLow',      label: 'Battery state of health too low for swap', eli5: 'The battery being returned has degraded too much and is not accepted for a battery swap. OCPP 2.1 battery-swap stations only.' },
      { versions: ['OCPP2.1'], code: 'BatterySoC',         label: 'Battery state of charge is unacceptable',  eli5: 'The battery\'s current charge level is outside acceptable bounds for this swap operation.' },
      { versions: ['OCPP2.1'], code: 'BatteryDamaged',     label: 'Battery is physically damaged',            eli5: 'The battery swap station detected physical damage on the returned battery.' },
      { versions: ['OCPP2.1'], code: 'BatteryUnknown',     label: 'Battery serial number not recognised',     eli5: 'The battery\'s serial number is not in the network\'s records — it may not be a registered battery.' },
      { versions: ['OCPP2.1'], code: 'BatteryType',        label: 'Battery type not accepted',                eli5: 'The battery type is not compatible with this swap station.' },
      { versions: ['OCPP2.1'], code: 'NoBatteryAvailable', label: 'No charged battery available for swap',    eli5: 'The customer requested a swap but the station has no charged batteries ready to provide.' },
      // ── Network Configuration ──
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'InvalidNetworkConf',   label: 'Invalid network configuration values',   eli5: 'One or more values in the NetworkConfiguration are invalid and were rejected.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'NoSecurityDowngrade',  label: 'Security profile downgrade not allowed', eli5: 'The request would reduce the security level (e.g. move from TLS to plain WebSocket). The charger refused — security profiles may only be upgraded.' },
      { versions: ['OCPP2.1'],               code: 'PriorityNetworkConf',  label: 'Priority network config variable cannot be changed', eli5: 'Attempted to change a variable in a NetworkConfiguration that is currently listed in NetworkConfigurationPriority — this is not permitted. OCPP 2.1 only.' },
      { versions: ['OCPP2.1'],               code: 'InvalidConfSlot',      label: 'Invalid configuration slot value',       eli5: 'The configurationSlot value used is not present in NetworkConfigurationPriority.valuesList. OCPP 2.1 only.' },
      // ── Miscellaneous ──
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'DuplicateRequestId',   label: 'Request ID has already been used',       eli5: 'The requestId sent (for firmware update, report requests, etc.) has already been used for this request type. Use a unique ID.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'InvalidMessageSeq',    label: 'Message sent at the wrong time',         eli5: 'The message is not expected at this point in the current OCPP exchange. Could be a protocol state machine error — e.g. sending SetChargingProfile before BootNotification is accepted.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'MissingDevModelInfo',  label: 'Device model information missing',       eli5: 'The operation needs Device Model data (component/variable definitions) that hasn\'t been configured on the charger yet.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'NoError',              label: 'No error — extra info in additionalInfo', eli5: 'The request succeeded, but there\'s supplementary information in the additionalInfo field. Not a failure — read additionalInfo for context.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'NotFound',             label: 'Requested object not found',             eli5: 'The ID or criteria provided didn\'t match anything. Common on ClearVariableMonitoring, GetChargingProfiles, GetDisplayMessages, GetReport requests.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'Unspecified',          label: 'Unspecified error — see additionalInfo',  eli5: 'No standard reason code fits, but extra detail should be in additionalInfo.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'UnsupportedRequest',   label: 'Request type not supported by this charger', eli5: 'The charger received a valid OCPP message but doesn\'t implement this feature. Check the charger\'s certification profile.' },
      // ── Operations & Permissions ──
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'FwUpdateInProgress',   label: 'Firmware update currently in progress',  eli5: 'The Reset or other command was rejected because a firmware update is actively being applied. Wait for the update to finish and the charger to reboot.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'NotEnabled',           label: 'Feature is disabled',                    eli5: 'The requested feature (e.g. ClearCache) is disabled via configuration on this charger.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'ReadOnly',             label: 'Variable is read-only',                  eli5: 'A SetVariables request tried to write to a variable that this charger only allows reading.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'WriteOnly',            label: 'Variable is write-only',                 eli5: 'A GetVariables request tried to read a variable that can only be written (e.g. a password field).' },
      // ── Security ──
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'InvalidCSR',           label: 'Certificate signing request is invalid', eli5: 'The CSR sent via SignCertificate doesn\'t meet the required format or cryptographic constraints.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'InvalidCertificate',   label: 'Certificate is invalid',                 eli5: 'The certificate provided (via CertificateSigned or InstallCertificate) failed validation — possibly expired, wrong issuer, or wrong key usage.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'InvalidURL',           label: 'URL provided is not valid',              eli5: 'The firmware or log file URL is malformed, unreachable, or uses a disallowed protocol.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'RedirectNotAllowed',   label: 'HTTP redirect not permitted',            eli5: 'The charger attempted to follow an HTTP redirect when fetching a log or firmware file, but its security policy forbids redirects.' },
      // ── System Errors ──
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'OutOfStorage',         label: 'Persistent storage is full',             eli5: 'The charger\'s flash storage is exhausted. Unlike OutOfMemory (RAM), this is a persistent storage issue — old logs or profiles may need clearing.' },
      // ── Transactions ──
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'TxStarted',            label: 'Transaction already started',            eli5: 'The platform tried to start a session, but one has already started automatically (e.g. because the cable was plugged in). The charger is already in a transaction.' },
      // ── Values & Ranges ──
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'InvalidValue',         label: 'Invalid value provided',                 eli5: 'A field contains a value that doesn\'t match the expected format or type.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'TooLargeElement',      label: 'Provided data is too large',             eli5: 'A certificate, profile, or message element exceeds the maximum allowed size.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'TooManyElements',      label: 'Too many items in the list',             eli5: 'The request contained more entries than allowed — e.g. too many variables in a SetVariables call, or too many schedule periods.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'UnsupportedParam',     label: 'Parameter not supported',                eli5: 'A parameter was included that this charger doesn\'t recognise or support.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'ValuePositiveOnly',    label: 'Value must be greater than zero',        eli5: 'A numeric field requires a positive value, but zero or a negative number was provided.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'ValueTooHigh',         label: 'Value exceeds maximum',                  eli5: 'A numeric field is above the allowed maximum — e.g. a power limit higher than the charger\'s rated capacity.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'ValueTooLow',          label: 'Value is below minimum',                 eli5: 'A numeric field is below the allowed minimum.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'ValueZeroNotAllowed',  label: 'Zero is not a valid value here',         eli5: 'A field that requires a non-zero value received zero — e.g. a charging limit of 0 watts would stop all charging and isn\'t permitted via this path.' },
    ],
  },

  // ── OCPP 2.0.1 + 2.1 Security Events (complete set) ─────────────────────
  {
    id: 'security-events-v2',
    label: 'Security Events — Complete Set',
    field: 'SecurityEventNotification.type (OCPP 2.0.1 + 2.1)',
    description: 'All standardised security event types from the OCPP 2.0.1 and 2.1 specs. The earlier Security Events section covers the most common 10; this section includes the full 21.',
    entries: [
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'CsmsFailedToAuthenticate',             label: 'Octopus back-end rejected by charger',        eli5: 'The charger rejected the CSMS\'s authentication credentials. This could mean the back-end\'s certificate has changed or expired, or there\'s a misconfiguration on the server side.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'SettingSystemTime',                    label: 'System clock was adjusted significantly',     eli5: 'The charger\'s internal clock was changed by more than the configured threshold. Logged because large time jumps can affect charging schedules and audit trails.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'SecurityLogWasCleared',                label: 'Security log was cleared',                    eli5: 'The security event log was wiped. This is a critical audit event — note when it happened and who may have done it.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'AttemptedReplayAttacks',               label: 'Replay attack attempt detected',              eli5: 'The charger detected a previously-sent message being resent — a sign of someone trying to replay an old command. The charger correctly rejected it.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'InvalidFirmwareSigningCertificate',    label: 'Firmware signing certificate is invalid',     eli5: 'The certificate used to verify the firmware signature is not trusted or has expired. The firmware was not installed.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'InvalidCsmsCertificate',               label: 'CSMS TLS certificate is invalid',             eli5: 'The TLS certificate presented by the Octopus back-end (CSMS) during the connection failed verification on the charger. Check if the server certificate has expired or changed.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'InvalidChargingStationCertificate',    label: 'Charger certificate (CertificateSigned) invalid', eli5: 'The certificate sent to the charger via CertificateSignedRequest was invalid or couldn\'t be verified.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'DiscardedRenewedClientCertificate',    label: 'New client certificate was discarded',        eli5: 'The charger couldn\'t successfully establish a connection using its newly issued certificate, so it fell back to the old one and discarded the new one.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'InvalidTLSVersion',                    label: 'TLS version is too old',                      eli5: 'The CSMS is using a TLS version below 1.2, which is not permitted by the OCPP security specification. The charger refused the connection.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'InvalidTLSCipherSuite',                label: 'TLS cipher suite not permitted',              eli5: 'The server proposed only cipher suites that don\'t meet the OCPP security requirements. The connection was refused.' },
      { versions: ['OCPP2.0.1', 'OCPP2.1'], code: 'MaintenanceLoginFailed',               label: 'Failed local maintenance login attempt',       eli5: 'Someone tried to log in to the charger\'s local maintenance interface but provided incorrect credentials. Monitor for repeated failures — could indicate an intrusion attempt.' },
    ],
  },

  // ── OCPP 1.6 Message Actions ─────────────────────────────────────────────
  {
    id: 'ocpp16-actions',
    label: 'OCPP 1.6 Message Actions',
    field: 'Action (OCPP 1.6 CALL messages)',
    description: 'All request/command types defined in OCPP 1.6. Each becomes a CALL message from charger→CSMS or CSMS→charger. In SOAP/WS mode these appear as urn:OCPP:1.6:2019:12:ActionName.',
    entries: [
      { versions: ['OCPP1.6'], code: 'Authorize',                   label: 'Verify a customer token before charging',      eli5: 'The charger asks the CSMS "is this RFID card / app token allowed to charge?" The CSMS replies Accepted, Blocked, Expired, or Invalid.' },
      { versions: ['OCPP1.6'], code: 'BootNotification',            label: 'Charger announces itself on startup',           eli5: 'Sent by the charger when it powers up or reconnects. Contains the charger model, serial number, and vendor. The CSMS must respond Accepted before the charger can operate.' },
      { versions: ['OCPP1.6'], code: 'CancelReservation',           label: 'Cancel a previously made booking',             eli5: 'CSMS→charger: cancel a reservation made with ReserveNow. The charger will free the connector.' },
      { versions: ['OCPP1.6'], code: 'ChangeAvailability',          label: 'Take a connector in/out of service',           eli5: 'CSMS→charger: set connector operative or inoperative. Used for maintenance or remote disabling.' },
      { versions: ['OCPP1.6'], code: 'ChangeConfiguration',         label: 'Update a configuration value on the charger',  eli5: 'CSMS→charger: set a configuration key (e.g. HeartbeatInterval). The charger may require a reboot for some keys.' },
      { versions: ['OCPP1.6'], code: 'ClearCache',                  label: 'Clear the local authorisation cache',          eli5: 'CSMS→charger: delete the locally stored list of known tokens. The charger must re-authorise everything with the CSMS after this.' },
      { versions: ['OCPP1.6'], code: 'ClearChargingProfile',        label: 'Remove a previously set charging schedule',    eli5: 'CSMS→charger: delete a charging profile by ID, connector, or stack level. Used to clear Octopus-set smart charging schedules.' },
      { versions: ['OCPP1.6'], code: 'DataTransfer',                label: 'Send vendor-specific data',                    eli5: 'A generic message for sending custom data not defined in the standard spec — used by charger manufacturers for proprietary extensions. Both charger→CSMS and CSMS→charger.' },
      { versions: ['OCPP1.6'], code: 'DiagnosticsStatusNotification', label: 'Progress update on a diagnostics upload',   eli5: 'Charger→CSMS: notifies the back-end that diagnostics file upload is in progress, succeeded, or failed (following a GetDiagnostics request).' },
      { versions: ['OCPP1.6'], code: 'FirmwareStatusNotification',  label: 'Progress update on a firmware update',         eli5: 'Charger→CSMS: reports the status of a firmware update (Downloading, Downloaded, Installing, Installed, etc.) following an UpdateFirmware request.' },
      { versions: ['OCPP1.6'], code: 'GetCompositeSchedule',        label: 'Retrieve the combined charging schedule',      eli5: 'CSMS→charger: asks what the net effective charging schedule is for a connector, taking all stacked profiles into account. Useful for debugging smart charging.' },
      { versions: ['OCPP1.6'], code: 'GetConfiguration',            label: 'Read configuration keys from the charger',     eli5: 'CSMS→charger: request the current value of one or more configuration keys. Used for diagnostics and remote auditing.' },
      { versions: ['OCPP1.6'], code: 'GetDiagnostics',              label: 'Request the charger to upload log files',       eli5: 'CSMS→charger: instruct the charger to upload its diagnostic log to a provided URL (typically SFTP or HTTP). The charger responds with the filename and then sends DiagnosticsStatusNotification updates.' },
      { versions: ['OCPP1.6'], code: 'GetLocalListVersion',         label: 'Check version of the local authorisation list', eli5: 'CSMS→charger: query the version number of the local authorisation list currently stored on the charger. Used to decide whether to push an update.' },
      { versions: ['OCPP1.6'], code: 'Heartbeat',                   label: 'Regular keep-alive ping from charger',         eli5: 'Sent periodically (typically every 5–60 minutes) to confirm the charger is still online and connected. The CSMS responds with the current time so the charger stays synchronised.' },
      { versions: ['OCPP1.6'], code: 'MeterValues',                 label: 'Periodic electrical measurement readings',     eli5: 'Charger→CSMS: sends measurement data (power, energy, voltage, current, SoC) at regular intervals or at session start/end. This is the data Octopus uses for billing and monitoring.' },
      { versions: ['OCPP1.6'], code: 'RemoteStartTransaction',      label: 'Start a charging session remotely',            eli5: 'CSMS→charger: command the charger to start a session on a given connector, optionally with a specific token. Used when the Octopus app or smart schedule triggers a charge.' },
      { versions: ['OCPP1.6'], code: 'RemoteStopTransaction',       label: 'Stop a charging session remotely',             eli5: 'CSMS→charger: stop an active session by transaction ID. Used when the customer stops via the app, or when an Octopus schedule ends.' },
      { versions: ['OCPP1.6'], code: 'ReserveNow',                  label: 'Reserve a connector for an upcoming session',  eli5: 'CSMS→charger: reserve a connector until a specific time for a given token. The connector will refuse other users until the reservation expires or is claimed.' },
      { versions: ['OCPP1.6'], code: 'Reset',                       label: 'Reboot the charger',                           eli5: 'CSMS→charger: restart the charger. Hard reset cycles power; Soft reset restarts the software without a power cycle.' },
      { versions: ['OCPP1.6'], code: 'SendLocalList',               label: 'Push the local authorisation list to charger', eli5: 'CSMS→charger: update or replace the full/partial local list of tokens the charger can authorise even when offline.' },
      { versions: ['OCPP1.6'], code: 'SetChargingProfile',          label: 'Push a smart charging schedule to charger',    eli5: 'CSMS→charger: set a charging profile defining when and at what power the car should charge. This is how Octopus delivers the smart overnight schedule to the charger.' },
      { versions: ['OCPP1.6'], code: 'StartTransaction',            label: 'Notification that a session has started',      eli5: 'Charger→CSMS: informs the CSMS that a charging session has begun, with the token used, connector ID, meter start value, and timestamp.' },
      { versions: ['OCPP1.6'], code: 'StatusNotification',          label: 'Connector status change notification',         eli5: 'Charger→CSMS: reports the new status of a connector (Available, Occupied, Faulted, etc.) and any error code. This is the primary signal Octopus uses to know what state each charger is in.' },
      { versions: ['OCPP1.6'], code: 'StopTransaction',             label: 'Notification that a session has ended',        eli5: 'Charger→CSMS: reports session end with the stop reason, meter stop reading, total energy, and any transaction data (e.g. SoC samples). Used for billing.' },
      { versions: ['OCPP1.6'], code: 'TriggerMessage',              label: 'Ask charger to resend a specific message',     eli5: 'CSMS→charger: request the charger to send a particular message right now (e.g. StatusNotification, Heartbeat, BootNotification). Useful for debugging when expected messages haven\'t arrived.' },
      { versions: ['OCPP1.6'], code: 'UnlockConnector',             label: 'Remotely release a stuck connector lock',      eli5: 'CSMS→charger: release the physical lock on a connector. Used when a customer\'s cable is stuck and can\'t be pulled out. The charger may end any active session first.' },
      { versions: ['OCPP1.6'], code: 'UpdateFirmware',              label: 'Instruct charger to download and install new firmware', eli5: 'CSMS→charger: provide a URL and scheduled time for the charger to download and install a firmware update. The charger sends FirmwareStatusNotification updates as it progresses.' },
    ],
  },

  // ── OCPP 1.6 Status & Error Enums ────────────────────────────────────────
  {
    id: 'ocpp16-chargepoint-status',
    label: 'OCPP 1.6 ChargePoint Status',
    field: 'StatusNotification.status (OCPP 1.6)',
    description: 'The connector status values from OCPP 1.6 StatusNotification messages. Note: OCPP 1.6 uses "ChargePointStatus" while OCPP 2.x uses "connectorStatus" — similar but not identical.',
    entries: [
      { versions: ['OCPP1.6'], code: 'Available',    label: 'Ready to charge — no car plugged in',    eli5: 'The connector is working and nothing is connected. Any authorised customer can plug in and start a session.' },
      { versions: ['OCPP1.6'], code: 'Preparing',    label: 'Car plugged in — waiting to start',       eli5: 'A car has plugged in but the session hasn\'t authorised or started yet. The charger is waiting for RFID, app command, or schedule trigger.' },
      { versions: ['OCPP1.6'], code: 'Charging',     label: 'Power flowing to the car',                eli5: 'A session is active and electricity is being transferred. Normal charging in progress.' },
      { versions: ['OCPP1.6'], code: 'SuspendedEVSE', label: 'Charger has paused — car would charge',  eli5: 'The charger paused the session. In IO Go context this is normal: Octopus is holding the session until the cheap window. The car is ready and waiting.' },
      { versions: ['OCPP1.6'], code: 'SuspendedEV',  label: 'Car has paused — charger is ready',       eli5: 'The car told the charger to pause. Battery management (cell balancing, heat management) or the car has hit an internal limit. Will auto-resume.' },
      { versions: ['OCPP1.6'], code: 'Finishing',    label: 'Session ending — car still plugged in',   eli5: 'The session has ended or is being stopped, but the cable is still physically connected. The connector will return to Available once unplugged.' },
      { versions: ['OCPP1.6'], code: 'Reserved',     label: 'Connector reserved for upcoming session', eli5: 'A reservation (ReserveNow) is active. Only the designated user can start a session until the reservation expires.' },
      { versions: ['OCPP1.6'], code: 'Unavailable',  label: 'Connector taken offline by operator',     eli5: 'The charger has been deliberately taken out of service by ChangeAvailability command — for maintenance, firmware update, or config change.' },
      { versions: ['OCPP1.6'], code: 'Faulted',      label: 'Fault detected — needs investigation',    eli5: 'A hardware or software fault has been detected. Check ChargePointErrorCode (below) for the specific fault type. No charging until resolved.' },
    ],
  },

  // ── OCPP 1.6 Error Codes ──────────────────────────────────────────────────
  {
    id: 'ocpp16-error-codes',
    label: 'OCPP 1.6 ChargePoint Error Codes',
    field: 'StatusNotification.errorCode (OCPP 1.6)',
    description: 'Hardware and software fault codes reported in OCPP 1.6 StatusNotification messages when status is Faulted or another degraded state.',
    entries: [
      { versions: ['OCPP1.6'], code: 'NoError',               label: 'No error — normal operation',                eli5: 'Everything is working fine. This is the errorCode value during normal operation — the charger is confirming there is no fault.' },
      { versions: ['OCPP1.6'], code: 'ConnectorLockFailure',  label: 'Cable lock mechanism failed',                eli5: 'The physical locking mechanism for the charging cable failed. The connector may not be properly secured, which is a safety concern.' },
      { versions: ['OCPP1.6'], code: 'EVCommunicationError',  label: 'Car communication failure (ISO 15118 / PWM)', eli5: 'The charger tried to communicate with the car (via pilot signal or ISO 15118) but failed. Can cause session not starting or SoC not reporting. May need cable check or car reboot.' },
      { versions: ['OCPP1.6'], code: 'GroundFailure',         label: 'Earth/ground wiring fault detected',         eli5: 'The charger\'s protection circuitry detected a fault in the earth/ground connection. This is a safety issue — the charger will refuse to charge until resolved. Requires electrician inspection.' },
      { versions: ['OCPP1.6'], code: 'HighTemperature',       label: 'Component overheating — thermal throttle',   eli5: 'An internal component (connector, power board, cable) is too hot. The charger may reduce power or stop charging to protect itself. Usually resolves when it cools down.' },
      { versions: ['OCPP1.6'], code: 'InternalError',         label: 'Internal software/firmware error',            eli5: 'An unhandled error occurred in the charger\'s software. A reboot often resolves this. Persistent errors suggest a firmware bug — report to the manufacturer.' },
      { versions: ['OCPP1.6'], code: 'LocalListConflict',     label: 'Conflict in local authorisation list',        eli5: 'The locally stored authorisation list is inconsistent or corrupted. Use ClearCache + SendLocalList to push a fresh list.' },
      { versions: ['OCPP1.6'], code: 'OtherError',            label: 'Unclassified error — see vendorErrorCode',   eli5: 'An error that doesn\'t fit any standard code. Check the vendorErrorCode and vendorId fields in the StatusNotification for the manufacturer-specific detail.' },
      { versions: ['OCPP1.6'], code: 'OverCurrentFailure',    label: 'Over-current protection triggered',          eli5: 'The charger detected a current draw exceeding safe limits and tripped its protection. Could be a fault in the car, cable, or charger hardware.' },
      { versions: ['OCPP1.6'], code: 'PowerMeterFailure',     label: 'Energy meter is faulty',                     eli5: 'The internal electricity meter in the charger isn\'t reporting correctly. Billing accuracy may be affected. May need hardware repair.' },
      { versions: ['OCPP1.6'], code: 'PowerSwitchFailure',    label: 'Power relay/contactor fault',                eli5: 'The relay or contactor that controls whether power flows to the connector has failed. The charger cannot safely start or stop charging.' },
      { versions: ['OCPP1.6'], code: 'ReaderFailure',         label: 'RFID reader fault',                          eli5: 'The RFID card reader is not functioning correctly. Customers may not be able to tap to start sessions. App-based starting should still work via RemoteStartTransaction.' },
      { versions: ['OCPP1.6'], code: 'ResetFailure',          label: 'Reboot/reset did not complete successfully',  eli5: 'The charger attempted a reset (following a Reset command or watchdog trigger) but encountered a problem during restart.' },
      { versions: ['OCPP1.6'], code: 'UnderVoltage',          label: 'Supply voltage too low',                     eli5: 'The incoming mains voltage has dropped below a safe threshold. The charger stopped to protect itself and the car. Check the property\'s electrical supply.' },
      { versions: ['OCPP1.6'], code: 'WeakSignal',            label: 'Poor network/cellular signal',               eli5: 'The charger\'s network connection (4G/LTE or Wi-Fi) has dropped to a very low signal level. OCPP messages may be delayed or lost. Check antenna placement.' },
    ],
  },

  // ── OCPP 1.6 Auth & Lifecycle Enums ──────────────────────────────────────
  {
    id: 'ocpp16-enums',
    label: 'OCPP 1.6 Auth & Lifecycle Enums',
    field: 'AuthorizationStatus · RegistrationStatus · ResetType · DiagnosticsStatus · FirmwareStatus',
    description: 'Core enumeration values from OCPP 1.6 response messages for authorisation, registration, resets, diagnostics, and firmware updates.',
    entries: [
      // AuthorizationStatus
      { versions: ['OCPP1.6'], code: 'Accepted',        label: 'Token accepted — charging permitted',        eli5: 'The authorisation check passed. The RFID card or token is valid and the customer may charge.' },
      { versions: ['OCPP1.6'], code: 'Blocked',         label: 'Token blocked — access denied',              eli5: 'The token has been explicitly blocked (e.g. account suspended, card reported stolen). The customer cannot charge.' },
      { versions: ['OCPP1.6'], code: 'Expired',         label: 'Token has expired',                          eli5: 'The token is valid but its validity period has passed. The customer needs a new token or the expiry date needs updating.' },
      { versions: ['OCPP1.6'], code: 'Invalid',         label: 'Token not recognised',                       eli5: 'The token (RFID UID or app token) is completely unknown to the CSMS. Not registered on the account.' },
      { versions: ['OCPP1.6'], code: 'ConcurrentTx',   label: 'Token already in use on another session',    eli5: 'The same token is already being used to charge on a different connector or charger. Most systems allow one active session per token.' },
      // RegistrationStatus
      { versions: ['OCPP1.6'], code: 'Pending',         label: 'Charger registered but not yet fully accepted', eli5: 'The CSMS received the BootNotification but hasn\'t fully provisioned the charger yet. The charger can send heartbeats but may not be able to start sessions.' },
      { versions: ['OCPP1.6'], code: 'Rejected',        label: 'Charger registration refused',               eli5: 'The CSMS rejected the BootNotification. The charger is not permitted to operate on this network. Check that the charger is provisioned with the correct CSMS endpoint and credentials.' },
      // ResetType
      { versions: ['OCPP1.6'], code: 'Hard',            label: 'Full power cycle (hardware reboot)',         eli5: 'A hard reset cycles the charger\'s mains power. All active sessions are ended. Use when a software reboot hasn\'t resolved the issue.' },
      { versions: ['OCPP1.6'], code: 'Soft',            label: 'Software reboot (no power cycle)',           eli5: 'A soft reset restarts the charger\'s software without cutting mains power. Active sessions may be gracefully closed. Faster than a hard reset and preferred for config changes.' },
      // DiagnosticsStatus
      { versions: ['OCPP1.6'], code: 'Idle',            label: 'Not currently uploading diagnostics',        eli5: 'The charger is not actively uploading diagnostic files — either no GetDiagnostics has been requested, or a previous upload already finished.' },
      { versions: ['OCPP1.6'], code: 'Uploading',       label: 'Diagnostics file upload in progress',        eli5: 'The charger is currently transferring its diagnostic log to the URL provided in GetDiagnostics.' },
      { versions: ['OCPP1.6'], code: 'Uploaded',        label: 'Diagnostics upload completed successfully',  eli5: 'The diagnostic file was successfully uploaded. The CSMS can now retrieve and analyse it.' },
      { versions: ['OCPP1.6'], code: 'UploadFailed',    label: 'Diagnostics upload failed',                  eli5: 'The charger tried to upload its log file but the transfer failed — likely a network issue or invalid upload URL. Check connectivity and the URL in the GetDiagnostics request.' },
      // FirmwareStatus
      { versions: ['OCPP1.6'], code: 'Downloading',     label: 'Firmware download in progress',              eli5: 'The charger is currently downloading the new firmware from the URL provided by UpdateFirmware.' },
      { versions: ['OCPP1.6'], code: 'Downloaded',      label: 'Firmware downloaded — ready to install',     eli5: 'The firmware file has been downloaded and verified. Installation will begin at the scheduled time.' },
      { versions: ['OCPP1.6'], code: 'DownloadFailed',  label: 'Firmware download failed',                   eli5: 'The charger could not download the firmware file. Check the URL, network connectivity, and whether the server requires authentication.' },
      { versions: ['OCPP1.6'], code: 'Installing',      label: 'Firmware installation in progress',          eli5: 'The charger is flashing the new firmware. Do not power off during this stage — it could brick the unit.' },
      { versions: ['OCPP1.6'], code: 'Installed',       label: 'Firmware installed and running',             eli5: 'The new firmware was successfully installed and the charger has rebooted. Check the charger\'s reported firmware version to confirm.' },
      { versions: ['OCPP1.6'], code: 'InstallationFailed', label: 'Firmware installation failed',            eli5: 'The charger downloaded the firmware but failed to flash it. It should revert to its previous working firmware. Escalate to the charger manufacturer if this persists.' },
    ],
  },
];

// ─── Compatibility data ───────────────────────────────────────────────────────
const COMPATIBLE_CHARGERS = [
  { brand: 'Ohme Home Pro', ocpp: '1.6', notes: 'Primary IO Go partner charger. Native smart charging integration.' },
  { brand: 'Ohme ePod', ocpp: '1.6', notes: 'Budget Ohme unit. Full IO Go compatibility.' },
  { brand: 'Andersen A2', ocpp: '1.6', notes: 'Requires OCPP firmware enabled via Andersen app.' },
  { brand: 'Wallbox Pulsar Plus', ocpp: '1.6 / 2.0.1', notes: 'OCPP mode must be enabled in myWallbox app.' },
  { brand: 'Wallbox Copper SB', ocpp: '2.0.1', notes: 'V2G capable (bidirectional). Requires compatible vehicle.' },
  { brand: 'Pod Point Solo 3', ocpp: '1.6', notes: 'OCPP connectivity requires Pod Point business account setup.' },
  { brand: 'Hypervolt Home 3', ocpp: '1.6', notes: 'Confirmed IO Go compatible. Check firmware is up to date.' },
  { brand: 'Indra Smart PRO', ocpp: '1.6', notes: 'V2G capable. Compatible with select bidirectional vehicles.' },
  { brand: 'EO Mini Pro 3', ocpp: '1.6', notes: 'OCPP available via EO Hub accessory.' },
  { brand: 'Rolec WallPod EV', ocpp: '1.6', notes: 'Commercial-grade. OCPP available on select models.' },
  { brand: 'Zappi v2', ocpp: '1.6', notes: 'Requires myenergi OCPP firmware. Solar-divert mode not active in IO Go OCPP mode.' },
];

const EV_NOTES = [
  {
    title: 'IO Go works at the charger level, not the car level',
    body: 'Intelligent Octopus Go communicates with the charger via OCPP — not directly with the car. This means any EV that can physically plug into an IO Go-compatible charger will benefit from smart overnight scheduling. The car just receives charge at whatever rate and time the charger delivers.',
  },
  {
    title: 'SoC reporting requires ISO 15118 or CHAdeMO',
    body: 'For the charger to report battery percentage (SoC) back to Octopus, the car must support ISO 15118 digital communication (Plug & Charge capable vehicles) or CHAdeMO. Most EVs do not currently share SoC data with third-party chargers — the customer sets their charge target in the Octopus app instead.',
  },
  {
    title: 'Plug & Charge (automatic authorisation) requires ISO 15118',
    body: 'Seamless plug-in-and-go without RFID or app interaction requires the car to support ISO 15118 and the charger to support it too. Currently limited to select vehicles (some Mercedes, BMW, certain Hyundai/Kia models). The majority of IO Go customers still start sessions via the app or RFID.',
  },
  {
    title: 'V2G (Vehicle-to-Grid) requires a bidirectional charger AND car',
    body: 'Exporting power back to the grid requires both a V2G-capable charger (e.g. Wallbox Copper SB, Indra Smart PRO) AND a bidirectional-capable vehicle (e.g. Nissan Leaf with CHAdeMO, some upcoming models). Standard IO Go does not include V2G — check the Octopus V2G tariff for this.',
  },
  {
    title: "Not sure if a customer's setup is compatible?",
    body: "Use the Vehicle Checker tool in this portal — it lists all confirmed compatible EVs and chargers. There is no single maintained public compatibility URL from Octopus. Content is accurate as of 18 April 2026 — always double-check with Octopus support for the very latest.",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function OcppDiagnostics() {
  const [activeTab,     setActiveTab]     = useState('overview');
  const [search,        setSearch]        = useState('');
  const [versionFilter, setVersionFilter] = useState('all'); // 'all'|'OCPP1.6'|'OCPP2.0.1'|'OCPP2.1'

  // Entries without an explicit `versions` field are implicitly OCPP 2.1 (existing content)
  const entryVersions = (e) => e.versions || ['OCPP2.1'];

  // Filter logic — matches code (exact/partial) OR label; also filters by version
  const q = search.trim().toLowerCase();
  const filtered = DIAGNOSTIC_CATEGORIES.map(cat => ({
    ...cat,
    entries: cat.entries.filter(e => {
      const matchesSearch  = !q || e.code.toLowerCase().includes(q) || e.label.toLowerCase().includes(q);
      const matchesVersion = versionFilter === 'all' || entryVersions(e).includes(versionFilter);
      return matchesSearch && matchesVersion;
    }),
  })).filter(cat => cat.entries.length > 0);

  const totalResults = filtered.reduce((acc, cat) => acc + cat.entries.length, 0);
  const totalAll     = DIAGNOSTIC_CATEGORIES.reduce((acc, c) => acc + c.entries.length, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-2">
          Intelligent Octopus Go
        </p>
        <h1 className="text-4xl md:text-5xl font-black text-white">
          <span className="octopus-text-gradient">OCPP Diagnostics</span>
        </h1>
        <p className="mt-3 text-gray-300 text-lg max-w-2xl">
          Decode charging diagnostic payloads and check IO Go hardware compatibility.
        </p>
        <Link
          to="/tariffs/intelligent"
          className="text-sm text-gray-300 hover:text-gray-300 underline mt-3 inline-block"
        >
          ← Back to Intelligent Octopus Go reference
        </Link>
      </header>

      {/* ── Tab strip ───────────────────────────────────────────────────────── */}
      <RefTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {/* ══════════════════════════════════════════════════════════════════════
          OVERVIEW TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="octopus-card-bg rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-white mb-4">What is OCPP?</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              <strong className="text-white">OCPP</strong> (Open Charge Point Protocol) is the industry-standard
              language that EV chargers use to talk to network management systems. Think of it like a universal
              translator — it means an Ohme charger, a Wallbox charger, and a Pod Point charger can all
              communicate with the Octopus back-end using the same protocol.
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              The current version used by most IO Go chargers is <strong className="text-white">OCPP 1.6</strong>.
              Newer chargers are beginning to support OCPP 2.0.1 and 2.1, which add V2G (vehicle-to-grid),
              better security, and more granular smart charging controls.
            </p>
            <p className="text-gray-300 leading-relaxed">
              The messages exchanged over OCPP are called <strong className="text-white">payloads</strong> —
              structured data packets that tell Octopus what the charger is doing, and let Octopus tell
              the charger what to do next.
            </p>
          </div>

          <div className="octopus-card-bg rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-white mb-4">How IO Go uses OCPP</h2>
            <div className="space-y-4">
              {[
                {
                  step: '1',
                  title: 'Charger connects to Octopus',
                  body: 'When an IO Go-compatible charger is set up, it establishes a WebSocket connection to the Octopus CSMS (Charge Station Management System) and sends a BootNotification. Octopus acknowledges it and they\'re linked.',
                },
                {
                  step: '2',
                  title: 'Customer plugs in their EV',
                  body: 'The charger detects the connection and sends a StatusNotification (Occupied) and a TransactionEvent (Started). Octopus knows the car is there.',
                },
                {
                  step: '3',
                  title: 'Octopus sends a smart charging schedule',
                  body: 'Using the customer\'s departure time and SoC target (set in the app), Octopus calculates the cheapest overnight charging window and pushes a ChargingProfile to the charger. The charger will hold the session in SuspendedEVSE mode until the cheap window opens.',
                },
                {
                  step: '4',
                  title: 'Charger executes the schedule',
                  body: 'At the scheduled time, the charger switches to CentralSetpoint mode and begins drawing power at the rate Octopus has specified. It sends periodic MeterValues so Octopus can track progress.',
                },
                {
                  step: '5',
                  title: 'Session completes',
                  body: 'Once the target is reached (SoC, energy amount, or departure time), the session ends. A final TransactionEvent (Ended) is sent with the stop reason and total energy consumed.',
                },
              ].map(item => (
                <div key={item.step} className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm">
                    {item.step}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm mb-1">{item.title}</p>
                    <p className="text-gray-300 text-sm leading-relaxed">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="octopus-card-bg rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-white mb-3">How to use the Diagnostics Decoder</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              When a customer or internal tool shows you a technical value from a charger diagnostic —
              like <code className="font-mono text-pink-300 bg-black/30 px-1 rounded">SuspendedEVSE</code> or{' '}
              <code className="font-mono text-pink-300 bg-black/30 px-1 rounded">TxInProgress</code> — go to
              the <button onClick={() => setActiveTab('decoder')} className="text-pink-400 hover:underline font-medium">Diagnostics Decoder tab</button> and
              type it into the search box. You'll instantly see the plain-English explanation.
            </p>
            <div className="bg-teal-900/30 border border-teal-600/30 rounded-xl p-4">
              <p className="text-teal-300 text-sm font-semibold mb-1">💡 Tip</p>
              <p className="text-gray-300 text-sm">
                You don't need to type the full code — partial matches work. Type{' '}
                <code className="font-mono text-pink-300 bg-black/30 px-1 rounded">suspend</code> to
                find both <code className="font-mono text-pink-300 bg-black/30 px-1 rounded">SuspendedEV</code> and{' '}
                <code className="font-mono text-pink-300 bg-black/30 px-1 rounded">SuspendedEVSE</code>.
                Ctrl+F also works on this page if you prefer.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          COMPATIBILITY TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'compat' && (
        <div className="space-y-6">

          {/* OCPP scope disclaimer */}
          <div className="bg-amber-900/30 border border-amber-600/30 rounded-xl p-4">
            <p className="text-amber-300 text-sm leading-relaxed">
              <span className="font-semibold">⚠️ Not all EVs use OCPP.</span> Tesla vehicles use a proprietary charging protocol
              and do not support OCPP natively — though some newer 2024+ Tesla models are beginning to add limited OCPP 1.6
              support. The charger compatibility information on this page is only relevant for OCPP-capable hardware.
              For Tesla-specific IO Go setup, see the <span className="font-semibold">IO Go Onboarding Guide</span>.
            </p>
          </div>

          {/* Charger compatibility table */}
          <div className="octopus-card-bg rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-white mb-2">Compatible Chargers</h2>
            <p className="text-gray-300 text-sm mb-5">
              These chargers support OCPP and have been used with Intelligent Octopus Go. Always confirm
              the customer has the latest firmware — OCPP support is sometimes added or improved via updates.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 pr-4 text-gray-300 font-semibold">Charger</th>
                    <th className="text-left py-2 pr-4 text-gray-300 font-semibold">OCPP</th>
                    <th className="text-left py-2 text-gray-300 font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {COMPATIBLE_CHARGERS.map(c => (
                    <tr key={c.brand}>
                      <td className="py-3 pr-4 text-white font-medium whitespace-nowrap">{c.brand}</td>
                      <td className="py-3 pr-4">
                        <span className="font-mono text-xs bg-black/30 text-teal-300 px-2 py-0.5 rounded">
                          {c.ocpp}
                        </span>
                      </td>
                      <td className="py-3 text-gray-300">{c.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-gray-300 text-xs mt-4">
              ℹ️ There is no single public-facing charger compatibility list maintained by Octopus. This table is accurate as of 18 April 2026 — always verify with Octopus support for the latest approved hardware.
            </p>
          </div>

          {/* EV compatibility notes */}
          <div className="octopus-card-bg rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-white mb-5">EV Compatibility Notes</h2>
            <div className="space-y-4">
              {EV_NOTES.map(note => (
                <div key={note.title} className="border-l-2 border-purple-600 pl-4">
                  <p className="text-white font-semibold text-sm mb-1">{note.title}</p>
                  <p className="text-gray-300 text-sm leading-relaxed">{note.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Connector type quick reference */}
          <div className="octopus-card-bg rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-white mb-2">Connector Quick Reference</h2>
            <p className="text-gray-300 text-sm mb-4">
              Common UK connector types for IO Go home charging. For full connector type codes, see the Diagnostics Decoder tab.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { type: 'Type 2 socket (sType2)', desc: 'Standard UK home charger socket — customer brings their own cable' },
                { type: 'Type 2 tethered (cType2)', desc: 'Cable permanently attached to charger — most convenient for daily use' },
                { type: 'CCS2 (cCCS2)', desc: 'DC rapid charging — not typical for home IO Go installs' },
                { type: 'CHAdeMO (cG105)', desc: 'Older Nissan Leaf / Mitsubishi DC rapid — rarely seen on home units' },
              ].map(item => (
                <div key={item.type} className="bg-white/5 rounded-xl p-3">
                  <p className="text-white text-sm font-semibold">{item.type}</p>
                  <p className="text-gray-300 text-xs mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          DIAGNOSTICS DECODER TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'decoder' && (
        <div>
          {/* Version filter pills */}
          <div className="flex flex-wrap gap-2 mb-3">
            {[
              { id: 'all',      label: 'All versions' },
              { id: 'OCPP1.6',   label: 'OCPP 1.6',   cls: 'border-blue-700/60 text-blue-300',   activeCls: 'bg-blue-700 text-white border-blue-600' },
              { id: 'OCPP2.0.1', label: 'OCPP 2.0.1', cls: 'border-amber-700/60 text-amber-300', activeCls: 'bg-amber-700 text-white border-amber-600' },
              { id: 'OCPP2.1',   label: 'OCPP 2.1',   cls: 'border-purple-700/60 text-purple-300', activeCls: 'bg-purple-700 text-white border-purple-600' },
            ].map(pill => (
              <button
                key={pill.id}
                onClick={() => setVersionFilter(pill.id)}
                className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${
                  versionFilter === pill.id
                    ? (pill.activeCls || 'bg-white/20 text-white border-white/30')
                    : (pill.cls     || 'border-white/20 text-gray-300 hover:text-white hover:border-white/40')
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* Search box */}
          <div className="relative mb-4">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Type a payload code or description (e.g. SuspendedEV, TxInProgress, Authorize)…"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              autoFocus
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white text-xl leading-none"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          {/* Result counter */}
          {(q || versionFilter !== 'all') && (
            <p className="text-sm text-gray-300 mb-5">
              {totalResults === 0
                ? 'No results'
                : <>{totalResults} result{totalResults !== 1 ? 's' : ''}{q ? <> for <span className="text-white font-mono">"{search}"</span></> : ''}{versionFilter !== 'all' ? <> · <span className="text-white font-mono">{versionFilter}</span></> : ''}</>
              }
            </p>
          )}

          {/* No results state */}
          {(q || versionFilter !== 'all') && totalResults === 0 && (
            <div className="text-center py-12 text-gray-300">
              <p className="text-4xl mb-3">🔍</p>
              <p className="font-medium text-gray-300">No matching payload codes found.</p>
              <p className="text-sm mt-1">Try a shorter term or check the spelling.</p>
            </div>
          )}

          {/* Category sections */}
          {filtered.map(cat => (
            <section key={cat.id} className="mb-8">
              {/* Category header */}
              <div className="flex items-baseline gap-3 mb-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">
                  {cat.label}
                </h3>
                {!q && (
                  <span className="text-xs text-gray-300 font-mono">
                    {cat.field}
                  </span>
                )}
              </div>
              {!q && cat.description && (
                <p className="text-gray-300 text-xs mb-3">{cat.description}</p>
              )}

              <div className="space-y-2">
                {cat.entries.map(entry => (
                  <div key={entry.code} className="octopus-card-bg rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm bg-black/40 text-pink-300 px-2 py-0.5 rounded select-all">
                          {entry.code}
                        </span>
                        {entryVersions(entry).map(v => (
                          <span key={v} className={`text-xs px-1.5 py-0.5 rounded font-mono border ${
                            v === 'OCPP1.6'   ? 'bg-blue-900/50 text-blue-300 border-blue-700/40' :
                            v === 'OCPP2.0.1' ? 'bg-amber-900/50 text-amber-300 border-amber-700/40' :
                                                 'bg-purple-900/50 text-purple-300 border-purple-700/40'
                          }`}>{v}</span>
                        ))}
                      </div>
                      {q && (
                        <span className="text-xs text-gray-300 shrink-0">{cat.label}</span>
                      )}
                    </div>
                    <p className="text-white font-semibold text-sm mb-1">{entry.label}</p>
                    <p className="text-gray-300 text-sm leading-relaxed">{entry.eli5}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {/* Footer hint when showing all */}
          {!q && versionFilter === 'all' && (
            <p className="text-center text-gray-300 text-xs pt-4 pb-8">
              {totalAll} entries across {DIAGNOSTIC_CATEGORIES.length} categories · OCPP 1.6 <span className="text-blue-500">■</span> · OCPP 2.0.1 <span className="text-amber-600">■</span> · OCPP 2.1 <span className="text-purple-500">■</span> —
              use the version pills or search box above to filter
            </p>
          )}
        </div>
      )}
    </div>
  );
}
