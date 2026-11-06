import { Link } from 'react-router-dom';
import { FileText, Printer, ShieldCheck } from 'lucide-react';
import './PrivacyNoticePage.css';

/**
 * DRAFT ONLY: do not release before the controller has completed and approved
 * the fields below, retention rules, actual processing purposes and processors.
 */
export default function PrivacyNoticePage() {
  return (
    <div className="privacy-page">
      <main className="privacy-document" id="privacy-content">
        <header className="privacy-header">
          <div className="privacy-brand"><ShieldCheck size={27} aria-hidden="true" /><span>GTA Szerviz</span></div>
          <div className="privacy-actions">
            <Link to="/login">Bejelentkezés</Link>
            <button type="button" onClick={() => window.print()}><Printer size={17} aria-hidden="true" /> Nyomtatás</button>
          </div>
        </header>

        <div className="privacy-draft" role="status">
          <strong>Tervezet – még nem használható ügyféltájékoztatásra.</strong>
          <span>A hivatalos székhelyet, az adatkezelési jogalapokat, a megőrzési időket és a technikai részleteket még véglegesíteni kell.</span>
        </div>

        <div className="privacy-heading">
          <FileText size={25} aria-hidden="true" />
          <div>
            <p>Ügyfelek részére</p>
            <h1>Adatkezelési tájékoztató</h1>
            <span>Tervezet • Utolsó frissítés: [jóváhagyás dátuma]</span>
          </div>
        </div>

        <section aria-labelledby="controller">
          <h2 id="controller">1. Az adatkezelő</h2>
          <p>Az ügyféladatokat a szervizt üzemeltető vállalkozás kezeli. A GTA Szerviz a műhely nyilvántartó alkalmazásának neve.</p>
          <dl>
            <div><dt>Vállalkozás</dt><dd>GTA Szerviz Kft.</dd></div>
            <div><dt>Ügyfélfogadás címe</dt><dd>2083 Solymár, Mátyás király út 45.</dd></div>
            <div><dt>Székhely</dt><dd>[hivatalos székhely ellenőrizendő]</dd></div>
            <div><dt>Kapcsolat</dt><dd><a href="mailto:gtaszerviz@gmail.com">gtaszerviz@gmail.com</a> · <a href="tel:+36304512755">+36 30 451 2755</a></dd></div>
          </dl>
        </section>

        <section aria-labelledby="data">
          <h2 id="data">2. Milyen adatokat és miért kezelünk?</h2>
          <p>A gépjárművek karbantartásával, javításával, műszaki vizsgálatával és ügyintézésével összefüggésben az indokolt adatokat kezeljük. Ilyenek lehetnek:</p>
          <ul>
            <li>ügyfél neve és a kapcsolattartáshoz szükséges elérhetőségei;</li>
            <li>rendszám, alvázszám, gyártmány, típus és a javításhoz szükséges műszaki jellemzők;</li>
            <li>időpontok, megrendelt munkák, munkalapok, javítási előzmények, felhasznált alkatrészek;</li>
            <li>a számlázáshoz és jogszabályi kötelezettségekhez szükséges adatok.</li>
          </ul>
          <p><strong>Véglegesítés szükséges:</strong> minden tényleges adatmezőt, adatkezelési célt és az ezekhez rendelt jogalapot a Kft. működése szerint ellenőrizni kell (például szerződés teljesítése vagy jogi kötelezettség).</p>
        </section>

        <section aria-labelledby="documents">
          <h2 id="documents">3. Forgalmi engedély és műszaki adatlap</h2>
          <p>Tervezett működés: a dokumentumot kizárólag a jármű szükséges adatainak rögzítéséhez használjuk. Későbbi OCR-funkció esetén a kép csak átmenetileg kerül feldolgozásra; a képet nem őrizzük meg az alkalmazásban. A felismert adatokat munkatársunk ellenőrzi, mielőtt elmenti.</p>
          <p><strong>Bevezetés előtt ellenőrizendő:</strong> a tényleges képfeldolgozási útvonal, ideiglenes fájlok, naplók és esetleges külső OCR-szolgáltatók.</p>
        </section>

        <section aria-labelledby="recipients">
          <h2 id="recipients">4. Adattárolás, hozzáférés és adatfeldolgozók</h2>
          <p>A műhely az adatokat jogosultsághoz kötött digitális nyilvántartásban kezeli. A szerverüzemeltetésben és biztonsági mentésben közreműködő szolgáltatók adatfeldolgozók lehetnek.</p>
          <p><strong>Véglegesítés szükséges:</strong> a tényleges tárhelyszolgáltató, a szerződéses adatfeldolgozói jogviszony, a mentések helye és a hozzáférési szabályok felsorolása.</p>
        </section>

        <section aria-labelledby="retention">
          <h2 id="retention">5. Megőrzési idők</h2>
          <p>Az adatokat a szükséges ideig, illetve az alkalmazandó jogszabályok által előírt időtartamig őrizzük.</p>
          <p><strong>Véglegesítés szükséges:</strong> adatcélonként pontos megőrzési idő vagy az idő meghatározásának szempontjai; különösen a munkalapok, számlák, műszaki vizsga és a biztonsági mentések esetében.</p>
        </section>

        <section aria-labelledby="rights">
          <h2 id="rights">6. Az érintettek jogai</h2>
          <p>Az ügyfél a GDPR feltételei szerint tájékoztatást és hozzáférést kérhet, kérheti adatainak helyesbítését, adott esetben törlését, az adatkezelés korlátozását, illetve élhet tiltakozási vagy adathordozhatósági jogával, ahol ezek alkalmazhatók.</p>
          <p>Kérelmével az 1. pontban szereplő adatkezelőhöz fordulhat. Panasszal a Nemzeti Adatvédelmi és Információszabadság Hatósághoz (NAIH) fordulhat, és bírósági jogorvoslatot is igénybe vehet.</p>
        </section>

        <section aria-labelledby="other">
          <h2 id="other">7. További tájékoztatás</h2>
          <p><strong>Véglegesítés szükséges:</strong> az adatszolgáltatás kötelező vagy szerződéskötéshez szükséges jellege és elmaradásának következményei; esetleges adattovábbítások, harmadik országba irányuló továbbítások, automatizált döntéshozatal, ha van ilyen.</p>
        </section>

        <footer className="privacy-footer">
          <span>GTA Szerviz • Adatkezelési tájékoztató – nem véglegesített tervezet</span>
          <Link to="/login">Vissza a bejelentkezéshez</Link>
        </footer>
      </main>
    </div>
  );
}
