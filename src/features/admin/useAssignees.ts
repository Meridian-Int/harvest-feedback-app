import { useEffect, useState } from 'react';
import { feedbackAssignees, type AssigneeOption } from '../../lib/administrators';
import { ASSIGNEES } from '../../lib/options';
export function useAssignees() {
  const [options, setOptions] = useState<AssigneeOption[]>([...ASSIGNEES]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = () => { void feedbackAssignees().then(rows => {
      if (active) { setOptions(rows); setError(null); }
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load Feedback administrators.'); }); };
    refresh();
    window.addEventListener('focus', refresh);
    return () => { active = false; window.removeEventListener('focus', refresh); };
  }, []);
  return { options, error };
}
