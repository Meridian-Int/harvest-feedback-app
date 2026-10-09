import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthProvider';
import { NewFeedbackForm } from './NewFeedbackForm';
import { clientApi, clientChoices, clientControls } from './foundation';

export function NewFeedbackPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  return <NewFeedbackForm key={user.id} api={clientApi} choices={clientChoices} controls={clientControls}
    draftScope={user.id} onOpenReport={id => navigate(`/feedback/mine?report=${encodeURIComponent(id)}`)}
    onSubmitted={() => navigate('/feedback/mine', { state: { message: 'Feedback submitted. You can track it in My reports.' } })} />;
}
