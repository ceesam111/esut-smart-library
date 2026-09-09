import { Navigate, useParams } from 'react-router-dom';

export default function CatalogRedirect() {
  const { id } = useParams<{ id?: string }>();
  return <Navigate to={id ? `/catalogue/${id}` : '/catalogue'} replace />;
}
