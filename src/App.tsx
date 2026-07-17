import { Navigate, RouterProvider, createHashRouter } from 'react-router';
import { GENERATORS } from './generators';
import { PortalLayout } from './portal/PortalLayout';
import { ThemeProvider } from './shared/theme/ThemeContext';

// 旧ポータルの URL は `/#music_player` 形式だったため、
// ハッシュルーターの `#/music_player` 形式へ正規化してブックマークを生かす
const legacyHash = window.location.hash.match(/^#([a-z_]+)$/);
if (legacyHash && GENERATORS.some(gen => gen.id === legacyHash[1])) {
  window.history.replaceState(null, '', `#/${legacyHash[1]}`);
}

const defaultPath = `/${GENERATORS[0].id}`;

const router = createHashRouter([
  {
    path: '/',
    element: <PortalLayout />,
    children: [
      { index: true, element: <Navigate to={defaultPath} replace /> },
      ...GENERATORS.map(gen => ({ path: gen.id, element: <gen.Component /> })),
      { path: '*', element: <Navigate to={defaultPath} replace /> },
    ],
  },
]);

export function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}
