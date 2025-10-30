import { redirect } from 'next/navigation';

/**
 * Root Page
 * Redirects users to the main feed page
 */
export default function RootPage() {
  redirect('/feed');
}
