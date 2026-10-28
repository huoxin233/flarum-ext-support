import { ticketTypes } from '../common/ticketTypes';

export { default as extend } from './extend';

app.initializers.add('linkrobins-support', () => {
  (app as any).support = { ticketTypes };
});
