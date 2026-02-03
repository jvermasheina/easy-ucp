# Easy UCP — Pitch Mikalle (Snowball Growth Partners)

## Yhden lauseen tiivistys

**Easy UCP tekee minkä tahansa verkkokaupan tuotteet löydettäviksi tekoälyostosagentille (ChatGPT, Claude, Gemini) — lataa tuotekatalogi ja ole valmis.**

---

## Mahdollisuus

- Google julkaisi **Universal Commerce Protocol (UCP)** -standardin 11. tammikuuta 2026
- UCP on standardi, jolla tekoälyagentit löytävät, selaavat ja suosittelevat tuotteita
- Ajattele sitä kuin **"SEO tekoälyostoksille"** — ilman UCP:tä tekoälyagentit eivät löydä sinua
- Shopify veloittaa siitä jo erikseen (Agentic Plan). Kaikilla muilla alustoilla ei ole mitään.

## Ongelma

| Alusta | UCP-tuki | Kauppojen määrä |
|--------|----------|-----------------|
| WooCommerce | Ei mitään | 6,5M |
| Magento | Ei mitään | 250K |
| BigCommerce | Ei mitään | 45K |
| PrestaShop | Ei mitään | 300K |
| Omat alustat | Ei mitään | Miljoonia |
| **Shopify** | **Maksullinen lisäpalvelu (Agentic Plan)** | 4,8M |

**Räätälöity UCP-integraatio maksaa 20-50K$ ja vie kuukausia.** Useimmilla kauppiailla ei ole siihen varaa.

## Ratkaisu

1. Kauppias rekisteröityy ja saa API-avaimen
2. Lataa tuotekatalogin (CSV-tiedosto, JSON tai API)
3. Me luomme UCP-yhteensopivat rajapinnat hänen tuotteilleen
4. Tekoälyostosagentit löytävät ja suosittelevat tuotteita
5. Asiakkaat klikkaavat kauppiaan omaan kassaan ostamaan

**Avainasia:** Me hoidamme vain löydettävyyden. Kauppias pitää oman kassansa, maksunvälityksensä ja logistiikkansa. Mikään ei muutu kaupan arjessa.

## Mitä voimme demota tänään

- Toimiva kauppiasrekisteröinti
- CSV/JSON-tuotelataus API:n kautta
- UCP-yhteensopiva tuotekatalogi-rajapinta (JSON-LD, Schema.org)
- Kauppiaskojelauta (ladatut tuotteet, UCP-endpoint URL)
- `.well-known/ucp`-löydettävyysrajapinta kauppiaalle
- Tekoälyreferenssi-seuranta (mitkä agentit käyttävät katalogia)

## Mitä on tulossa (ei vielä rakennettu)

- Tekoälykauppa-analytiikkakojelauta (konversioseuranta, suosituimmat tuotteet)
- WooCommerce/Magento-lisäosat automaattiseen tuotesynkronointiin
- Maksunvälitys alustamme kautta (mahdollinen Kustom-kumppanuus)
- Logistiikkaintegraatio (mahdollinen Shipit-kumppanuus)

*Olemme rehellisiä tästä jaottelusta. Vaihe 1 on löydettävyys + uudelleenohjaus. Vaihe 2 on täysi kaupankäyntiinfra.*

---

## Mikan portfolioyrityksille

**Kysymys:** Minkä e-commerce-portfolioyrityksen tuotteet halutaan ensimmäisinä tekoälyn löydettäviksi?

**Mitä tarjoamme (Mikan portfoliolle erityisesti):**
- **Täysin ilmainen pilotti** — ei maksua, ei sitoutumista
- Käytännön onboarding (autamme viemään tuotekatalogin ja lataamaan sen)
- Suora palautesilmukka — heidän kokemuksensa muokkaa tuotetta
- He saavat tekoälynäkyvyyden ennen kilpailijoita
- Jos toimii, voivat lukita elinikäisen hinnoittelun ennen julkista lanseerausta

**Mitä oppisimme:**
- Toimiiko CSV-lataustyönkulku oikealle kauppiaalle?
- Minkä kokoisia tuotekatalogia on tyypillisesti?
- Mitä MVP:stä puuttuu?
- Onko "tekoälylöydettävyys" vakuuttava myyntipuhe kauppiaille?

**Ihannepilottiyritys:**
- Verkkokauppa (mikä tahansa alusta paitsi Shopify)
- 50-5 000 tuotetta
- Kiinnostunut edelläkävijäedusta tekoälykaupassa

---

## Liiketoimintamalli

| Taso | Tuotteet | Elinikäinen hinta | Kuukausihinta (lanseerauksen jälkeen) |
|------|----------|-------------------|--------------------------------------|
| Micro | Alle 100 | $199 | $49/kk |
| Small | 100-1 000 | $399 | $99/kk |
| Medium | 1 000-10 000 | $599 | $149/kk |
| Large | Rajaton | $999 | $199/kk |

*Rajoitetun ajan elinikäiset hinnat perustajalistalle. Lanseerauksen jälkeen vain kuukausihinnoittelu.*

**Mikan portfolioyritykselle:** Ilmainen pilotti — haluamme validoinnin, emme tuloja tässä vaiheessa.

## Miksi juuri nyt

- UCP on 3 viikkoa vanha — ei vakiintuneita kilpailijoita
- Useimmat alustat eivät lisää natiivitukea 12-24 kuukauteen
- Edelläkävijät saavat tekoälynäkyvyysedun
- Ikkuna ennen kommoditoitumista: 6-12 kuukautta

## Pyyntö

1. **Esittely yhdelle portfolioyritykselle**, joka haluaa kokeilla ilmaista pilottia
2. Palautetta siitä, resonoiko arvolupaus Mikan verkostossa
3. Jos pilotti toimii: esittelyjä useammille portfolioyrityksille

---

## Tekniset tiedot (jos kysytään)

- **Teknologia:** Node.js/Express, Supabase (PostgreSQL), Railway-hostaus
- **UCP-versio:** 2026-01-11 (uusin)
- **Data:** Vain julkinen tuotetieto tallennetaan (nimi, hinta, kuvaus, URL, kuvat)
- **Tietoturva:** GDPR-yhteensopiva, ei asiakastietoja, ei maksutietoja

## Yhteystiedot

- Palvelu: easyucp.com
- Tekijä: Solo founder, Helsinki
