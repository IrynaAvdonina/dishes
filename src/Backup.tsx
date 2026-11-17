import { useState } from 'react'
import { db } from './db'
import { canShareFiles, downloadFile, exportFile, isBadFile, parseBackup, replaceAll, type ParsedBackup } from './backupData'
import { plural } from './logic'
import { seedDishes } from './seed'

type Stage =
  | { k: 'menu' }
  | { k: 'confirm'; data: ParsedBackup; current: number; base?: boolean }
  | { k: 'done'; text: string }

const strav = (n: number) => `${n} ${plural(n, 'страва', 'страви', 'страв')}`
const fmtDate = (d: Date) => d.toLocaleString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** Аркуш «Резервна копія»: зберегти всі дані у файл або відновити з файлу (повна заміна). */
export default function BackupSheet({ onClose }: { onClose: () => void }) {
  const [stage, setStage] = useState<Stage>({ k: 'menu' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const share = canShareFiles()

  const run = async (f: () => Promise<void>) => {
    setBusy(true); setMsg(null)
    try { await f() } catch (e) {
      setMsg({ text: isBadFile(e) ? e.message : 'Щось пішло не так. Спробуйте ще раз.', bad: true })
      if (!isBadFile(e)) console.error(e)
    } finally { setBusy(false) }
  }

  const save = () => run(async () => {
    const { file, dishes } = await exportFile()
    downloadFile(file)
    setMsg({ text: `Збережено ${strav(dishes)} у файл ${file.name} (папка «Завантаження»).` })
  })
  const shareIt = () => run(async () => {
    const { file } = await exportFile()
    try { await navigator.share({ files: [file], title: 'Страви: резервна копія' }) }
    catch (e) { if ((e as Error).name !== 'AbortError') throw e }
  })
  const pick = (f?: File | null) => f && run(async () => {
    const data = await parseBackup(await f.text())
    setStage({ k: 'confirm', data, current: await db.dishes.count() })
  })
  // базовий набір страв (той, що бачить кожен новий користувач); ваші продукти лишаються
  const pickBase = () => run(async () => {
    const data: ParsedBackup = { exportedAt: null, dishes: seedDishes(), pantry: await db.pantry.toArray() }
    setStage({ k: 'confirm', data, current: await db.dishes.count(), base: true })
  })
  const apply = (data: ParsedBackup, base?: boolean) => run(async () => {
    await replaceAll(data)
    setStage({ k: 'done', text: base ? `Завантажено базовий набір: ${strav(data.dishes.length)}. Ваші продукти залишились.`
      : `Відновлено ${strav(data.dishes.length)} і ${data.pantry.length} ${plural(data.pantry.length, 'продукт', 'продукти', 'продуктів')}.` })
  })

  return (
    <div className="overlay">
      <button className="bg" aria-label="Закрити" onClick={onClose} disabled={busy} />
      <div className="sheet" role="dialog" aria-label="Резервна копія" aria-busy={busy}>
        <div className="grab" />

        {stage.k === 'menu' && (<>
          <div className="shead"><h2 className="u">Резервна копія</h2><button className="textbtn" onClick={onClose}>Готово</button></div>
          <div className="hint" style={{ fontSize: 13.5 }}>Страви, фото й продукти зберігаються лише на цьому телефоні. Збережіть файл, щоб не втратити їх або перенести на інший телефон.</div>
          <button className="primary" style={{ marginTop: 12 }} disabled={busy} onClick={save}>Зберегти у файл</button>
          {share && <button className="dashed" style={{ marginTop: 10 }} disabled={busy} onClick={shareIt}>Надіслати файл (Диск, месенджер…)</button>}

          <div className="lbl" style={{ marginTop: 22 }}>Відновлення</div>
          <label className="dashed" style={{ cursor: 'pointer', opacity: busy ? .6 : 1 }}>
            Відновити з файлу…
            <input type="file" accept="application/json,.json" hidden disabled={busy} onChange={e => { pick(e.target.files?.[0]); e.target.value = '' }} />
          </label>
          <div className="hint">Усі поточні дані буде замінено вмістом файлу. Перед заміною застосунок перепитає.</div>
          <button className="dashed" style={{ marginTop: 14, borderColor: '#B7C3EE' }} disabled={busy} onClick={pickBase}>Базовий набір страв</button>
          <div className="hint">Замінити страви стартовим набором (як у нового користувача). «Мої продукти» залишаться.</div>
        </>)}

        {stage.k === 'confirm' && (<>
          <h2 className="u">{stage.base ? 'Замінити страви?' : 'Замінити всі дані?'}</h2>
          <div style={{ fontSize: 14.5, lineHeight: 1.45, margin: '10px 0 4px' }}>
            {stage.base ? <>У базовому наборі: <b>{strav(stage.data.dishes.length)}</b> без фото. Ваші продукти залишаться.</> : <>
            У файлі: <b>{strav(stage.data.dishes.length)}</b>, {stage.data.pantry.length} {plural(stage.data.pantry.length, 'продукт', 'продукти', 'продуктів')}
            {stage.data.exportedAt && <>, збережено {fmtDate(stage.data.exportedAt)}</>}.</>}
          </div>
          <div className="warnbox" style={{ marginTop: 10 }}>Зараз у застосунку {strav(stage.current)}. Вони зникнуть і будуть замінені {stage.base ? 'базовим набором' : 'стравами з файлу'}. Скасувати це не можна.</div>
          <button className="primary" style={{ marginTop: 16, background: 'var(--warn)' }} disabled={busy} onClick={() => apply(stage.data, stage.base)}>Замінити</button>
          <button className="dashed" style={{ marginTop: 10 }} disabled={busy} onClick={save}>Спершу зберегти поточні дані</button>
          <button className="textbtn" style={{ width: '100%', marginTop: 6 }} disabled={busy} onClick={() => { setStage({ k: 'menu' }); setMsg(null) }}>Скасувати</button>
        </>)}

        {stage.k === 'done' && (<>
          <h2 className="u">Готово</h2>
          <div style={{ fontSize: 14.5, lineHeight: 1.45, margin: '10px 0 16px' }}>{stage.text}</div>
          <button className="primary" onClick={onClose}>До каталогу</button>
        </>)}

        {msg && <div role="status" className={msg.bad ? 'warnbox' : 'hint'} style={{ marginTop: 12, fontSize: 13.5 }}>{msg.text}</div>}
      </div>
    </div>
  )
}
