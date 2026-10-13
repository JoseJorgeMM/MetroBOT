import { useServiceStatus } from '../hooks/useServiceStatus';
import { ServiceStatusView } from './ServiceStatusView';
import type { RouteOption } from '../lib/routing';

export function SystemStatus({ route }: { route?: Pick<RouteOption, 'steps'> }) {
  const snapshot = useServiceStatus();
  return <ServiceStatusView snapshot={snapshot} route={route} />;
}
