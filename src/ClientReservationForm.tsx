// src/ClientReservationForm.tsx
import { useState } from "react";
import { supabase } from "./lib/supabase";

export function ClientReservationForm() {
  const [email, setEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [serviceType, setServiceType] = useState("居宅介護");
  const [serviceSubtype, setServiceSubtype] = useState("");
  const [fromPlace, setFromPlace] = useState("");
  const [toPlace, setToPlace] = useState("");
  const [note, setNote] = useState("");
  const [preferredHelper, setPreferredHelper] = useState("");

  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!email || !clientName || !date || !startTime || !endTime) {
      setMessage("メール・お名前・日付・時間は必須です。");
      return;
    }

    setSending(true);
    try {
      // 1) clients を email で upsert
      const { data: clientRows, error: clientErr } = await supabase
        .from("clients")
        .upsert(
          {
            email,
            client_name: clientName,
          },
          { onConflict: "email" }
        )
        .select()
        .maybeSingle();

      if (clientErr) {
        console.error(clientErr);
        throw new Error("利用者情報の登録でエラーが発生しました。");
      }

      const clientId = clientRows?.client_id ?? null;

      // 2) reservation_requests に INSERT
      const { error: rErr } = await supabase.from("reservation_requests").insert({
        client_id: clientId,
        email,
        date,                 // 'YYYY-MM-DD'
        start_time: startTime, // 'HH:MM'
        end_time: endTime,
        service_type: serviceType,
        service_subtype: serviceSubtype || null,
        from_place: fromPlace || null,
        to_place: toPlace || null,
        note: note || null,
        preferred_helper: preferredHelper || null,
        channel: "form",
        status: "requested",
      });

      if (rErr) {
        console.error(rErr);
        throw new Error("予約の登録でエラーが発生しました。");
      }

      setMessage("予約を受け付けました。事業所からの連絡をお待ちください。");

      // 入力クリア（任意）
      // setDate(""); ... 必要に応じて
    } catch (err: any) {
      setMessage(err.message ?? "予期せぬエラーが発生しました。");
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h1>ヘルパー予約フォーム（仮）</h1>

      <div>
        <label>メールアドレス（必須）</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div>
        <label>お名前（必須）</label>
        <input
          type="text"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          required
        />
      </div>

      <div>
        <label>日付（必須）</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>

      <div>
        <label>開始時間（必須）</label>
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          required
        />
      </div>

      <div>
        <label>終了時間（必須）</label>
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          required
        />
      </div>

      <div>
        <label>サービス種別</label>
        <select
          value={serviceType}
          onChange={(e) => setServiceType(e.target.value)}
        >
          <option value="居宅介護">居宅介護</option>
          <option value="家事援助">家事援助</option>
          <option value="移動支援">移動支援</option>
        </select>
      </div>

      <div>
        <label>サービス詳細（任意）</label>
        <input
          type="text"
          placeholder="通院・買い物・散歩など"
          value={serviceSubtype}
          onChange={(e) => setServiceSubtype(e.target.value)}
        />
      </div>

      <div>
        <label>出発地（from）</label>
        <input
          type="text"
          value={fromPlace}
          onChange={(e) => setFromPlace(e.target.value)}
        />
      </div>

      <div>
        <label>到着地（to）</label>
        <input
          type="text"
          value={toPlace}
          onChange={(e) => setToPlace(e.target.value)}
        />
      </div>

      <div>
        <label>希望ヘルパー（任意）</label>
        <input
          type="text"
          value={preferredHelper}
          onChange={(e) => setPreferredHelper(e.target.value)}
        />
      </div>

      <div>
        <label>備考</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <button type="submit" disabled={sending}>
        {sending ? "送信中..." : "予約を送信"}
      </button>

      {message && <p>{message}</p>}
    </form>
  );
}

