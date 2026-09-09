import { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';

interface FeatureRouteProps {
  feature: keyof typeof institutionConfig.features;
  children: ReactElement;
}

export default function FeatureRoute({ feature, children }: FeatureRouteProps) {
  if (!institutionConfig.features[feature]) {
    return <Navigate to="/not-found" replace />;
  }
  return children;
}
