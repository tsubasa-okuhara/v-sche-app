// src/App.tsx
import { MonthlyReservationForm } from "./MonthlyReservationForm";

const HIROBA_URL = 'https://client-sche.web.app/';

export default function App() {
  return (
    <div className="app-shell">
      <a href={HIROBA_URL} className="backBtn">← ひろばに戻る</a>
      <MonthlyReservationForm />
    </div>
  );
}
