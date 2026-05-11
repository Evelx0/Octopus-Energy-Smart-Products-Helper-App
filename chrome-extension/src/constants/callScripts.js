export const CALL_SCRIPTS = {
  agile: [
    {
      title: 'Is Agile right for me?',
      questions: ['Can you shift any high-use appliances?', 'Do you usually use much power from 4pm-9pm?', 'Would price alerts help you plan?'],
      response: 'Agile rewards flexibility. If you can move usage into cheaper slots, especially overnight or midday, it can be very competitive. If your usage is fixed in the evening peak, Tracker or a fixed tariff may feel calmer.',
    },
    {
      title: 'Worried about price spikes',
      questions: ['Are they concerned about one slot or the whole bill?', 'Can they avoid flexible usage during the spike?', 'Do they want help reading today’s chart?'],
      response: 'Spikes are visible ahead of time and usually short. The important thing is the customer’s usage during those specific slots, not the highest price on the chart.',
    },
  ],
  tracker: [
    {
      title: 'Rates changed this month',
      questions: ['Is the question about electricity, gas, or both?', 'Are they comparing to SVT or their last bill?', 'Do they want certainty or wholesale transparency?'],
      response: 'Tracker follows wholesale movement, so rates can change. It is built for customers who want transparent daily pricing, not a fixed monthly unit rate.',
    },
  ],
  intelligent: [
    {
      title: 'Car did not charge',
      questions: ['Was the car plugged in and below target?', 'Was smart charging enabled?', 'Any charger app or OCPP error?'],
      response: 'Check app connection first, then charger status, then the IO Go diagnostics. Most failures are connectivity, scheduling, or authorisation rather than the tariff itself.',
    },
  ],
  flux: [
    {
      title: 'Is Flux worth it?',
      questions: ['Do they have solar PV?', 'Do they have a home battery?', 'Can they avoid importing from 4pm-7pm?'],
      response: 'Flux is strongest when solar and battery work together: charge cheaply, avoid peak import, and export when the rate is valuable.',
    },
  ],
  cosy: [
    {
      title: 'Heat pump running at peak',
      questions: ['Is the heat pump controller scheduled?', 'Is there a setback temperature for 4pm-7pm?', 'Does the home pre-heat before peak?'],
      response: 'Cosy savings depend on the heat pump schedule. Pre-heat before peak, set back during 4pm-7pm, and use the cheap windows to maintain comfort.',
    },
  ],
};
