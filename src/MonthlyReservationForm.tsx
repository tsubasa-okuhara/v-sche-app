// src/MonthlyReservationForm.tsx
import React, { useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

type YearMonth = {
  year: number;
  month: number; // 1–12
};

const TARGET: YearMonth = { year: 2025, month: 12 };

type CommonFields = {
  email: string;
  clientName: string;
  startTime: string;
  endTime: string;
  serviceType: string;
  serviceSubtype: string;
  fromPlace: string;
  toPlace: string;
  preferredHelper: string;
  note: string;
};

type ReservationRow = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  service_type: string;
  service_subtype: string | null;
  from_place: string | null;
  to_place: string | null;
  preferred_helper: string | null;
  note: string | null;
};

export const MonthlyReservationForm: React.FC = () => {
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  const [fields, setFields] = useState<CommonFields>({
    email: "",
    clientName: "",
    startTime: "15:30",
    endTime: "16:30",
    serviceType: "移動支援",
    serviceSubtype: "",
    fromPlace: "田園調布特別支援学校",
    toPlace: "下丸子スキップランド",
    preferredHelper: "",
    note: "",
  });

  const [sending, setSending] = useState(false);

  // この月の予約一覧
  const [reservations, setReservations] = useState<ReservationRow[]>([]);

  // 確認用カレンダーで「どの日を詳しく見るか」
  const [viewDay, setViewDay] = useState<number | null>(null);

  // 日ごとの予約一覧にまとめる
  const reservationsByDay = useMemo(() => {
    const map: Record<number, ReservationRow[]> = {};
    for (const r of reservations) {
      const d = new Date(r.date);
      const day = d.getDate();
      if (!map[day]) map[day] = [];
      map[day].push(r);
    }
    return map;
  }, [reservations]);

  // 2025/12 のカレンダー情報
  const calendarMatrix = useMemo(() => {
    const { year, month } = TARGET;
    const first = new Date(year, month - 1, 1);
    const firstWeekday = first.getDay(); // 0=Sun
    const lastDay = new Date(year, month, 0).getDate();

    const cells: (number | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= lastDay; d++) cells.push(d);

    const matrix: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      matrix.push(cells.slice(i, i + 7));
    }
    return matrix;
  }, []);

  const toggleDay = (day: number | null) => {
    if (!day) return;
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleFieldChange = (key: keyof CommonFields, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  // 指定メールアドレスの「2025-12」の予約一覧を取得
  const loadReservations = async (email: string) => {
    const { year, month } = TARGET;
    const from = `${year}-${String(month).padStart(2, "0")}-01`;
    const to = `${year}-${String(month).padStart(2, "0")}-31`;

    const { data, error } = await supabase
      .from("reservation_requests")
      .select(
        "id, date, start_time, end_time, service_type, service_subtype, from_place, to_place, preferred_helper, note"
      )
      .eq("email", email)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    setReservations((data || []) as ReservationRow[]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fields.email || !fields.clientName) {
      alert("メールアドレスとお名前は必須です。");
      return;
    }
    if (selectedDays.length === 0) {
      alert("少なくとも1日を選択してください。");
      return;
    }

    setSending(true);
    try {
      const { year, month } = TARGET;

      // 1) clients を email で upsert（既存あれば更新・なければ作成）
      const { data: clientRow, error: clientErr } = await supabase
        .from("clients")
        .upsert(
          {
            email: fields.email,
            client_name: fields.clientName,
          },
          { onConflict: "email" }
        )
        .select()
        .maybeSingle();

      if (clientErr) {
        console.error(clientErr);
        throw new Error("利用者情報の登録でエラーが発生しました。");
      }

      const clientId = clientRow?.client_id ?? null;

      // 2) 選択された日付ごとの payload を作成
      const payload = selectedDays
        .sort((a, b) => a - b)
        .map((day) => ({
          client_id: clientId,
          email: fields.email,
          date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
            2,
            "0"
          )}`,
          start_time: fields.startTime,
          end_time: fields.endTime,
          service_type: fields.serviceType,
          service_subtype: fields.serviceSubtype || null,
          from_place: fields.fromPlace || null,
          to_place: fields.toPlace || null,
          preferred_helper: fields.preferredHelper || null,
          note: fields.note || null,
          channel: "form",
          status: "requested",
        }));

      console.log("★ Supabase に送信する予約リクエスト");
      console.table(payload);

      // 3) reservation_requests に一括 INSERT
      const { error: rErr } = await supabase
        .from("reservation_requests")
        .insert(payload);

      if (rErr) {
        console.error(rErr);
        throw new Error("予約の登録でエラーが発生しました。");
      }

      alert(`予約を受け付けました。（${payload.length}件）`);

      // 4) 一覧を再読み込み
      await loadReservations(fields.email);

      // 必要に応じて日付だけリセット
      // setSelectedDays([]);
    } catch (err: any) {
      alert(err.message ?? "予期せぬエラーが発生しました。");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="monthly-reservation">
      <h1>ヘルパー予約フォーム（2025年12月：複数日一括）</h1>

      {/* 利用者情報 */}
      <section className="mr-section mr-section-user">
        <h2>利用者情報</h2>
        <div className="mr-user-grid">
          <label>メールアドレス（必須）</label>
          <input
            type="email"
            value={fields.email}
            onChange={(e) => handleFieldChange("email", e.target.value)}
          />

          <label>お名前（必須）</label>
          <input
            type="text"
            value={fields.clientName}
            onChange={(e) => handleFieldChange("clientName", e.target.value)}
          />
        </div>

        <button
          type="button"
          className="mr-button-sub"
          onClick={() => {
            if (!fields.email) {
              alert("メールアドレスを入力してください。");
            } else {
              loadReservations(fields.email);
            }
          }}
        >
          この月の予約一覧を読み込む
        </button>
      </section>

      {/* カレンダー＋共通情報 */}
      <section className="mr-layout-two-column">
        {/* カレンダー（入力用） */}
        <div>
          <h2>
            {TARGET.year}年 {TARGET.month}月の予定日
          </h2>

          <div className="mr-calendar-wrapper mr-calendar-wrapper--input">
            <div className="mr-calendar-weekdays">
              <strong style={{ color: "red" }}>日</strong>
              <strong>月</strong>
              <strong>火</strong>
              <strong>水</strong>
              <strong>木</strong>
              <strong>金</strong>
              <strong style={{ color: "blue" }}>土</strong>
            </div>

            <div className="mr-calendar-grid">
              {calendarMatrix.map((week, idx) => (
                <div key={idx} className="mr-calendar-row">
                  {week.map((day, i) => {
                    if (day === null) {
                      return <div key={i} />;
                    }
                    const selected = selectedDays.includes(day);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className="mr-calendar-cell-button"
                        style={{
                          border: selected
                            ? "2px solid #007bff"
                            : "1px solid #ccc",
                          background: selected ? "#e6f0ff" : "#fff",
                        }}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <p className="mr-selected-days">
            選択中の日付：
            {selectedDays.length === 0
              ? "なし"
              : selectedDays.sort((a, b) => a - b).join(", ")}{" "}
            日
          </p>
        </div>

        {/* 共通の支援内容 */}
        <div>
          <h2>共通の支援内容</h2>
          <div className="mr-common-grid">
            <label>開始時間</label>
            <input
              type="time"
              value={fields.startTime}
              onChange={(e) => handleFieldChange("startTime", e.target.value)}
            />

            <label>終了時間</label>
            <input
              type="time"
              value={fields.endTime}
              onChange={(e) => handleFieldChange("endTime", e.target.value)}
            />

            <label>サービス種別</label>
            <select
              value={fields.serviceType}
              onChange={(e) => handleFieldChange("serviceType", e.target.value)}
            >
              <option value="居宅介護">居宅介護</option>
              <option value="家事援助">家事援助</option>
              <option value="移動支援">移動支援</option>
            </select>

            <label>サービス詳細（任意）</label>
            <input
              type="text"
              placeholder="通学・通院・買い物など"
              value={fields.serviceSubtype}
              onChange={(e) =>
                handleFieldChange("serviceSubtype", e.target.value)
              }
            />

            <label>出発地（from）</label>
            <input
              type="text"
              value={fields.fromPlace}
              onChange={(e) => handleFieldChange("fromPlace", e.target.value)}
            />

            <label>到着地（to）</label>
            <input
              type="text"
              value={fields.toPlace}
              onChange={(e) => handleFieldChange("toPlace", e.target.value)}
            />

            <label>希望ヘルパー（任意）</label>
            <input
              type="text"
              value={fields.preferredHelper}
              onChange={(e) =>
                handleFieldChange("preferredHelper", e.target.value)
              }
            />

            <label>備考</label>
            <textarea
              value={fields.note}
              onChange={(e) => handleFieldChange("note", e.target.value)}
              rows={3}
            />
          </div>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <button
          onClick={handleSubmit}
          disabled={sending}
          className="mr-button-main"
        >
          {sending
            ? "送信中..."
            : "選択した日にちにまとめて予約内容を適用（Supabaseに保存）"}
        </button>
      </section>

      {/* この月の予約一覧（カレンダー形式） */}
      <section className="mr-section" style={{ marginTop: 32 }}>
        <h2>2025年12月の予約一覧（カレンダー）</h2>

        {reservations.length === 0 ? (
          <p>まだ予約はありません。</p>
        ) : (
          <>
            <div className="mr-calendar-weekdays">
              <span style={{ color: "red" }}>日</span>
              <span>月</span>
              <span>火</span>
              <span>水</span>
              <span>木</span>
              <span>金</span>
              <span style={{ color: "blue" }}>土</span>
            </div>

            <div className="mr-calendar-wrapper mr-calendar-wrapper--summary">
              <div className="mr-calendar-grid">
                {calendarMatrix.map((week, idx) => (
                  <div key={idx} className="mr-calendar-row">
                    {week.map((day, i) => {
                      if (day === null) {
                        return (
                          <div
                            key={i}
                            className="mr-calendar-cell"
                            style={{
                              minHeight: 60,
                              border: "1px solid #eee",
                              background: "#fafafa",
                            }}
                          />
                        );
                      }

                      const dayReservations = reservationsByDay[day] || [];
                      const isViewing = viewDay === day;

                      return (
                        <div
                          key={i}
                          onClick={() => setViewDay(day)}
                          className="mr-calendar-cell"
                          style={{
                            minHeight: 80,
                            border: isViewing
                              ? "2px solid #007bff"
                              : "1px solid #ddd",
                            background: isViewing ? "#e6f0ff" : "#fff",
                          }}
                        >
                          {/* 日付ヘッダ */}
                          <div className="mr-calendar-cell-header">
                            {day}
                          </div>

                          {/* その日の予約一覧 */}
                          {dayReservations.length === 0 ? (
                            <div style={{ color: "#aaa" }}>予約なし</div>
                          ) : (
                            dayReservations.map((r) => (
                              <div key={r.id} className="mr-calendar-chip">
                                <div>
                                  {r.start_time}〜{r.end_time}
                                </div>
                                <div>
                                  {r.service_type}
                                  {r.service_subtype
                                    ? `（${r.service_subtype}）`
                                    : ""}
                                </div>
                                <div className="mr-calendar-chip-route">
                                  {(r.from_place || "-") +
                                    " → " +
                                    (r.to_place || "-")}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      {/* 選択中の日の詳細表示 */}
      {viewDay !== null && (reservationsByDay[viewDay] || []).length > 0 && (
        <section className="mr-section" style={{ marginTop: 24 }}>
          <h3>
            {TARGET.year}年 {TARGET.month}月 {viewDay}日の予約詳細
          </h3>
          {(reservationsByDay[viewDay] || []).map((r) => (
            <div key={r.id} className="mr-detail-card">
              <div className="mr-detail-title">
                {r.start_time}〜{r.end_time} / {r.service_type}
                {r.service_subtype ? `（${r.service_subtype}）` : ""}
              </div>
              <div>
                {r.from_place || "-"} → {r.to_place || "-"}
              </div>
              {r.note && (
                <div className="mr-detail-note">備考：{r.note}</div>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
};