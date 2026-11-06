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
          <span>A jogalapok, a megőrzési idők, a szolgáltatói szerződések és a technikai szabályok még ellenőrzésre és jóváhagyásra várnak.</span>
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
            <div><dt>Vállalkozás</dt><dd>GTA Szerviz Korlátolt Felelősségű Társaság (GTA Szerviz Kft.)</dd></div>
            <div><dt>Ügyfélfogadás címe</dt><dd>2083 Solymár, Mátyás király út 45.</dd></div>
            <div><dt>Székhely</dt><dd>2083 Solymár, Mátyás Király út 45.</dd></div>
            <div><dt>Cégjegyzékszám</dt><dd>13-09-210427</dd></div>
            <div><dt>Adószám</dt><dd>29028933-2-13</dd></div>
            <div><dt>Kapcsolat</dt><dd><a href="mailto:gtaszerviz@gmail.com">gtaszerviz@gmail.com</a></dd></div>
          </dl>
        </section>

        <section aria-labelledby="data">
          <h2 id="data">2. Milyen adatokat és miért kezelünk?</h2>
          <p>A GTA Szerviz Kft. a nála javításra vagy szervizelésre leadott járművek és ügyfeleik adatait kezeli a javítás megszervezéséhez, elvégzéséhez, az ügyféllel való kapcsolattartáshoz, az alkatrészek azonosításához és a korábbi munkák visszakereséséhez.</p>
          <ul>
            <li>az ügyfél neve és a kapcsolattartáshoz használt telefonszáma;</li>
            <li>szükség szerint, nem minden ügyfélnél: e-mail-cím, lakcím vagy számlázási cím; céges ügyfeleknél a szükséges céges és kapcsolattartói adatok;</li>
            <li>a jármű rendszáma, alvázszáma, márkája, típusa és a munkához szükséges egyéb műszaki adatai;</li>
            <li>elvégzett javítások, munkalapadatok, szervizidőpontok, beépített alkatrészek neve és cikkszáma, javítási előzmények;</li>
            <li>a számlázáshoz, valamint a jogszabályban előírt nyilvántartáshoz szükséges adatok.</li>
          </ul>
          <p>A szerviztörténet visszakeresésének célja például annak megállapítása, hogy egy járműben mikor és milyen alkatrészt cseréltek. A beszállító vagy rendelési szám külön rögzítése nem általános követelmény.</p>
          <p><strong>Jogalapok – jóváhagyandó:</strong> a javítás teljesítéséhez szükséges műveleteknél a szerződés teljesítése, a kötelező bizonylatkezelésnél jogi kötelezettség merülhet fel. A szerződés teljesítésén túl megőrzött, visszakereshető szerviztörténet jogalapját külön meg kell vizsgálni; jogos érdek alkalmazása esetén dokumentált érdekmérlegelés szükséges.</p>
        </section>

        <section aria-labelledby="documents">
          <h2 id="documents">3. Dokumentumok, fényképek és későbbi funkciók</h2>
          <p>A jelenleg ismertetett működés szerint az alkalmazásban ügyfél- és járműfényképeket nem tartanak nyilván. A munkalapot korábban jellemzően a számlával együtt átadták az ügyfélnek; a papíralapú megőrzés gyakorlatát még ellenőrizni kell.</p>
          <p><strong>Csak tervezett fejlesztés:</strong> a forgalmi engedélyből vagy más dokumentumból történő OCR-adatkinyerés, illetve a műszaki vizsga lejárata előtti telefonos emlékeztető. Ezek jelenleg nem részei a működő adatkezelésnek. Bevezetésük előtt külön fel kell mérni a szükséges adatokat, jogalapot, tárolást, külső szolgáltatókat, és az értesítéshez kapcsolódó hozzájárulási vagy más jogi követelményeket.</p>
          <p>A műszaki vizsgáztatást külön vállalkozás végzi. A GTA Szerviz nyilvántartásába a szervizelt járművek kerülnek; a másik vállalkozásnál az ügyfél külön intézi a vizsgáztatást és a meghatalmazást. Ezt az elhatárolást tényleges adatátadás esetén felül kell vizsgálni.</p>
        </section>

        <section aria-labelledby="recipients">
          <h2 id="recipients">4. Adattárolás, hozzáférés és szolgáltatók</h2>
          <p>Az alkalmazás adatait a vállalkozás RackForest által biztosított VPS-környezetben működő digitális nyilvántartása tárolja. Hozzájuk a feladatukhoz szükséges mértékben a vállalkozás jogosult munkatársai férhetnek hozzá; a jelenleg ismert használók a műhely vezetője és egy szerelő, külön felhasználói fiókkal. A tényleges jogosultsági korlátokat még ellenőrizni kell.</p>
          <p>A számlázás a Számlázz.hu szolgáltatásával történik. A számlázási adatok kezelésében a szolgáltatás üzemeltetője, a KBOSS.hu Kft. is érintett. Az adattovábbítás, a szolgáltatói szerepek és az adatfeldolgozói megállapodások pontos tartalmát a véglegesítés előtt ellenőrizni kell.</p>
          <p>Az éles adatbázisról és az alkalmazáshoz tartozó fájlokról napi biztonsági mentés készül. Az ellenőrzött mentések jelenleg ugyanazon a VPS-en találhatók; szerveren kívüli mentés még nincs bevezetve. A mentésekhez való hozzáférést és az alkalmazott jogosultságokat, valamint a szolgáltatói szerződéseket véglegesítés előtt ellenőrizni kell.</p>
        </section>

        <section aria-labelledby="retention">
          <h2 id="retention">5. Megőrzési idők</h2>
          <p><strong>Tervezett szabály – még nem bevezetett automatikus törlés:</strong> a javítási előzményeket és a beépített alkatrészek adatait az utolsó szervizeléstől számított öt évig tervezik megőrizni, majd felülvizsgálni. Ez a határidő csak az adatkezelési jogalap, az esetleges igényérvényesítés és más jogszabályi kötelezettségek ellenőrzése után véglegesíthető.</p>
          <p>Az ügyfelek kapcsolattartási adatait nem szükséges automatikusan ugyanannyi ideig őrizni, mint a műszaki szerviztörténetet; a szükségtelenné vált személyes adatok külön törlését vagy leválasztását a rendszerben meg kell tervezni.</p>
          <p>A számviteli bizonylatokra a vonatkozó számviteli megőrzési szabályok irányadók, általában legalább nyolc év. Ez nem jelent általános nyolcéves megőrzést minden szervizadat számára.</p>
          <p>A napi biztonsági mentések automatikus törlési szabályát még nem igazolták. A felvetett harmincnapos gördülő megőrzés jelenleg terv, nem bevezetett szabály; a tényleges időtartamot és a biztonságos törlést később kell rögzíteni.</p>
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
