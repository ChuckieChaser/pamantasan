// --- IMPORTS ---
import { LoadingSpinner } from '../components/feedback/LoadingSpinner';


// --- COMPONENTS ---
export const LoaderRoute = ({ label = 'Authenticating session...' }) => {
    return (
        <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-surface p-4">
            <LoadingSpinner size="lg" variant="accent" label={label} />
        </div>
    );
};
