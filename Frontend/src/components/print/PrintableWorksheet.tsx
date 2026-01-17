import React from 'react';
import { JobPart } from '../../types';

interface Props {
    data: {
        id: number;
        customerName: string;
        vehiclePlate: string;
        vehicleType: string; // Ez most a gyártmány és típus egyben
        description: string;
        jobParts: JobPart[];
        laborCost: number;
        date: string;
    }
}

export const PrintableWorksheet = React.forwardRef<HTMLDivElement, Props>(({ data }, ref) => {
    
    // Stílusok a nyomtatványhoz (fekete-fehér, vékony keretek)
    const styles = {
        container: {
            padding: '20px',
            fontFamily: '"Times New Roman", Times, serif', // Hivatalosabb betűtípus
            color: 'black',
            background: 'white',
            fontSize: '12px',
            maxWidth: '210mm', // A4 szélesség
            margin: '0 auto'
        },
        table: {
            width: '100%',
            borderCollapse: 'collapse' as const,
            marginBottom: '5px'
        },
        td: {
            border: '1px solid black',
            padding: '4px',
            verticalAlign: 'top' as const
        },
        th: {
            border: '1px solid black',
            background: '#eee',
            padding: '4px',
            fontWeight: 'bold',
            textAlign: 'center' as const
        },
        headerText: {
            fontSize: '14px',
            fontWeight: 'bold',
            textAlign: 'center' as const,
            textTransform: 'uppercase' as const
        },
        smallText: {
            fontSize: '10px',
            color: '#333'
        },
        inputLine: {
            borderBottom: '1px dotted black',
            display: 'inline-block',
            width: '100%',
            height: '14px'
        }
    };

    return (
        <div ref={ref} style={styles.container}>
            
            {/* 1. FEJLÉC TÁBLÁZAT */}
            <table style={styles.table}>
                <tbody>
                    <tr>
                        <td style={{...styles.td, width: '30%'}}>Száma: <b>GTA 2026/{data.id}</b></td>
                        <td style={{...styles.td, width: '40%', fontSize: '18px', textAlign: 'center', fontWeight: 'bold'}}>MUNKALAP</td>
                        <td style={{...styles.td, width: '30%'}}>Kelt: <b>{data.date}</b></td>
                    </tr>
                </tbody>
            </table>

            {/* 2. MEGRENDELŐ ÉS VÁLLALKOZÁS */}
            <table style={styles.table}>
                <thead>
                    <tr>
                        <th style={{...styles.th, width: '50%'}}>MEGRENDELŐ</th>
                        <th style={{...styles.th, width: '50%'}}>VÁLLALKOZÁS</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style={{...styles.td, height: '100px'}}>
                            <div>Név: <b>{data.customerName}</b></div>
                            <div style={{marginTop: '5px'}}>Cím: <span style={{borderBottom: '1px dotted black', paddingRight: '50px'}}> </span></div>
                            <div style={{marginTop: '5px', display: 'flex', gap: '10px'}}>
                                <span>Tel: .......................................</span>
                            </div>
                            <div style={{marginTop: '15px', fontSize: '10px'}}>
                                [ ] Tulajdonos &nbsp;&nbsp; [ ] Üzembentartó &nbsp;&nbsp; [ ] Meghatalmazott
                            </div>
                        </td>
                        <td style={{...styles.td, textAlign: 'center'}}>
                            <div style={{fontWeight: 'bold', fontSize: '14px', marginTop: '10px'}}>GTA Szerviz Kft.</div>
                            <div style={{marginTop: '5px'}}>2083 Solymár, Mátyás király utca 45.</div>
                            <div style={{marginTop: '5px'}}>Tel: +36-70/422-8889</div>
                            <div style={{marginTop: '5px'}}>Adószám: 29028933-2-13</div>
                        </td>
                    </tr>
                </tbody>
            </table>

            {/* 3. JÁRMŰ ADATOK */}
            <div style={{textAlign: 'center', fontWeight: 'bold', border: '1px solid black', borderBottom: 'none', background: '#eee', padding: '2px'}}>JÁRMŰ ADATOK</div>
            <table style={styles.table}>
                <tbody>
                    <tr>
                        <td style={styles.td}>Frsz: <b>{data.vehiclePlate}</b></td>
                        <td style={styles.td}>Gyártmány/Típus: <b>{data.vehicleType}</b></td>
                        <td style={styles.td}>Típus: .....................</td>
                    </tr>
                    <tr>
                        <td style={styles.td}>Km óra: .....................</td>
                        <td style={styles.td}>Alvázszám: ...........................................</td>
                        <td style={{...styles.td, fontSize: '10px'}}>
                            Üzemanyag: 1/4 [ ] 1/2 [ ] 3/4 [ ] 4/4 [ ]
                        </td>
                    </tr>
                    <tr>
                        <td colSpan={3} style={{...styles.td, fontSize: '10px'}}>
                            Forg. eng. [ ] Köt. bef. ig. [ ] Rádió+antenna [ ] Pótkerék [ ] Emelő [ ] Izzó készlet [ ] Eü. doboz [ ]
                        </td>
                    </tr>
                </tbody>
            </table>

            {/* 4. SÉRÜLÉS & HIBA LEÍRÁS */}
            <table style={styles.table}>
                <tbody>
                    <tr>
                        <td style={styles.td}>
                            Sérülés: &nbsp; nincs [ X ] &nbsp; van [ ] &nbsp; (a sérülésről fénykép készült)
                        </td>
                    </tr>
                    <tr>
                        <td style={{...styles.td, height: '140px'}}>
                            <div style={{borderBottom: '1px solid black', paddingBottom: '5px', marginBottom: '5px'}}>
                                Hiba leírás / Megrendelt munka: &nbsp; 
                                <span style={{fontSize: '10px'}}>műszaki vizsga [ ] &nbsp; átvizsgálás [ ] &nbsp; szerviz [ X ]</span>
                            </div>
                            {/* Itt jelenítjük meg a leírást, amit beírtál a gépbe */}
                            <div style={{fontFamily: 'Courier New, monospace', fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap'}}>
                                {data.description ? data.description.toUpperCase() : "NINCS LEÍRÁS MEGADVA."}
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>

            {/* 5. ALKATRÉSZEK LISTÁJA (Opcionális, ha akarod, hogy a papíron is rajta legyenek a tételek) */}
             <table style={styles.table}>
                <thead>
                    <tr style={{background: '#eee'}}>
                        <th style={{...styles.th, textAlign: 'left'}}>Beépített Anyagok / Alkatrészek</th>
                        <th style={{...styles.th, width: '50px'}}>Db</th>
                        <th style={{...styles.th, width: '80px'}}>Ár</th>
                    </tr>
                </thead>
                <tbody>
                    {data.jobParts.length > 0 ? data.jobParts.map((part, i) => (
                        <tr key={i}>
                            <td style={styles.td}>{part.itemName} ({part.partNumber || '-'})</td>
                            <td style={{...styles.td, textAlign: 'center'}}>{part.quantity}</td>
                            <td style={{...styles.td, textAlign: 'right'}}>{part.unitPrice}</td>
                        </tr>
                    )) : (
                        <tr><td colSpan={3} style={{...styles.td, textAlign: 'center', color: '#999'}}>Még nincs alkatrész rögzítve</td></tr>
                    )}
                     <tr>
                        <td colSpan={2} style={{...styles.td, textAlign: 'right', fontWeight: 'bold'}}>Munkadíj:</td>
                        <td style={{...styles.td, textAlign: 'right'}}>{data.laborCost}</td>
                    </tr>
                </tbody>
            </table>

            {/* 6. HATÁRIDŐK ÉS NYILATKOZAT */}
            <table style={styles.table}>
                <tbody>
                    <tr>
                        <td style={{...styles.td, width: '50%'}}>Vállalási határidő: <b>2026 ...........</b></td>
                        <td style={{...styles.td, width: '50%'}}>Várható javítási költség (nettó Ft): .....................</td>
                    </tr>
                    <tr>
                        <td colSpan={2} style={{...styles.td, fontSize: '9px', textAlign: 'justify', lineHeight: '1.1'}}>
                            <b>Megrendelő nyilatkozata:</b> Az Adatvédelmi Szabályzatban illetve Vállalási Szabályzatban foglaltakat megismertem, tudomásul vettem és ennek ismeretében rendelem meg a munka elvégzését. Tudomásul veszem, hogy az általam hozott anyagokra, alkatrészekre a vállalkozó garanciát nem vállal. A jármű készre jelentése után legkésőbb 3 munkanapon belül köteles vagyok a járművet elszállítani (számla kiegyenlítése után), ezen túl a vállalkozó tárolási díjat számíthat fel. A jármű javítása után esetenként közúti próbára kerülhet sor. A járműben hagyott személyes tárgyakért felelősséget nem vállalunk.
                        </td>
                    </tr>
                </tbody>
            </table>

            {/* 7. ALÁÍRÁSOK */}
            <table style={{...styles.table, marginTop: '20px', border: 'none'}}>
                <tbody>
                    <tr>
                        <td style={{width: '45%', textAlign: 'center', border: 'none'}}>
                            <div style={{borderBottom: '1px solid black', marginBottom: '5px', height: '30px'}}></div>
                            A jármű fenti munkáit megrendelem és a <br/> járművet átadom <br/> (megrendelő)
                        </td>
                        <td style={{width: '10%', border: 'none'}}></td>
                        <td style={{width: '45%', textAlign: 'center', border: 'none'}}>
                            <div style={{borderBottom: '1px solid black', marginBottom: '5px', height: '30px'}}></div>
                             GTA Szerviz Kft. <br/> A járművet átvettem <br/> (vállalkozó képviselője)
                        </td>
                    </tr>
                </tbody>
            </table>

            {/* 8. LÁBLÉC (Átadás-Átvétel) */}
            <div style={{border: '1px solid black', marginTop: '10px'}}>
                <div style={{borderBottom: '1px solid black', padding: '5px', fontSize: '10px'}}>
                    Az elvégzett munka megfelelő, a jármű közúti forgalomban résztvehet.
                </div>
                <table style={{width: '100%', borderCollapse: 'collapse'}}>
                    <tbody>
                        <tr>
                            <td style={{borderRight: '1px solid black', padding: '5px', width: '25%'}}>Átadó:</td>
                            <td style={{borderRight: '1px solid black', padding: '5px', width: '25%'}}>Kelt: 2026.............</td>
                            <td style={{borderRight: '1px solid black', padding: '5px', width: '25%'}}>Átvevő:</td>
                            <td style={{padding: '5px', width: '25%'}}>Kelt: .................</td>
                        </tr>
                    </tbody>
                </table>
            </div>

        </div>
    );
});