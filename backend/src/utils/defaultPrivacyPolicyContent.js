// Default Privacy Policy page content for new stores
const defaultPrivacyPolicyContent = `
<div style="max-width: 900px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;">
  <h1 style="font-size: 2.5rem; font-weight: bold; color: #111827; margin-bottom: 1.5rem; border-bottom: 3px solid #2563EB; padding-bottom: 0.5rem;">
    Privacy Policy
  </h1>

  <p style="color: #6B7280; margin-bottom: 2rem; font-size: 0.95rem;">
    <em>Last updated: ${new Date().toLocaleDateString()}</em>
  </p>

  <div style="line-height: 1.8; color: #374151;">
    <section style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.5rem; font-weight: 600; color: #111827; margin-bottom: 1rem;">Introduction</h2>
      <p style="margin-bottom: 1rem;">
        Welcome to {{store_name}}. We respect your privacy and are committed to protecting your personal data.
        This privacy policy will inform you about how we look after your personal data when you visit our website
        and tell you about your privacy rights and how the law protects you.
      </p>
    </section>

    <section style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.5rem; font-weight: 600; color: #111827; margin-bottom: 1rem;">Information We Collect</h2>
      <p style="margin-bottom: 0.5rem;">We may collect, use, store and transfer different kinds of personal data about you:</p>
      <ul style="margin-left: 1.5rem; margin-bottom: 1rem;">
        <li style="margin-bottom: 0.5rem;"><strong>Identity Data:</strong> Name, username, or similar identifier</li>
        <li style="margin-bottom: 0.5rem;"><strong>Contact Data:</strong> Email address, telephone number, billing and delivery addresses</li>
        <li style="margin-bottom: 0.5rem;"><strong>Transaction Data:</strong> Details about payments and products you have purchased from us</li>
        <li style="margin-bottom: 0.5rem;"><strong>Technical Data:</strong> IP address, browser type, time zone setting, and location</li>
        <li style="margin-bottom: 0.5rem;"><strong>Usage Data:</strong> Information about how you use our website and services</li>
        <li style="margin-bottom: 0.5rem;"><strong>Marketing Data:</strong> Your preferences in receiving marketing from us</li>
      </ul>
    </section>

    <section style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.5rem; font-weight: 600; color: #111827; margin-bottom: 1rem;">How We Use Your Information</h2>
      <p style="margin-bottom: 0.5rem;">We use your personal data for the following purposes:</p>
      <ul style="margin-left: 1.5rem; margin-bottom: 1rem;">
        <li style="margin-bottom: 0.5rem;">To process and deliver your orders</li>
        <li style="margin-bottom: 0.5rem;">To manage your account and provide customer support</li>
        <li style="margin-bottom: 0.5rem;">To improve our website, products, and services</li>
        <li style="margin-bottom: 0.5rem;">To send you marketing communications (with your consent)</li>
        <li style="margin-bottom: 0.5rem;">To comply with legal obligations</li>
      </ul>
    </section>

    <section style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.5rem; font-weight: 600; color: #111827; margin-bottom: 1rem;">Cookies</h2>
      <p style="margin-bottom: 1rem;">
        We use cookies and similar tracking technologies to track activity on our website and store certain information.
        You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
        However, if you do not accept cookies, you may not be able to use some portions of our website.
      </p>
      <p style="margin-bottom: 1rem;">
        For more information about the cookies we use, please see our Cookie Consent banner when you first visit our website.
      </p>
    </section>

    <section style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.5rem; font-weight: 600; color: #111827; margin-bottom: 1rem;">Data Security</h2>
      <p style="margin-bottom: 1rem;">
        We have put in place appropriate security measures to prevent your personal data from being accidentally lost,
        used, or accessed in an unauthorized way. We limit access to your personal data to those employees, agents,
        contractors, and other third parties who have a business need to know.
      </p>
    </section>

    <section style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.5rem; font-weight: 600; color: #111827; margin-bottom: 1rem;">Your Rights</h2>
      <p style="margin-bottom: 0.5rem;">Under data protection laws, you have rights including:</p>
      <ul style="margin-left: 1.5rem; margin-bottom: 1rem;">
        <li style="margin-bottom: 0.5rem;"><strong>Right to access:</strong> Request access to your personal data</li>
        <li style="margin-bottom: 0.5rem;"><strong>Right to rectification:</strong> Request correction of inaccurate data</li>
        <li style="margin-bottom: 0.5rem;"><strong>Right to erasure:</strong> Request deletion of your personal data</li>
        <li style="margin-bottom: 0.5rem;"><strong>Right to restrict processing:</strong> Request restriction on processing</li>
        <li style="margin-bottom: 0.5rem;"><strong>Right to data portability:</strong> Request transfer of your data</li>
        <li style="margin-bottom: 0.5rem;"><strong>Right to object:</strong> Object to processing of your personal data</li>
      </ul>
    </section>

    <section style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.5rem; font-weight: 600; color: #111827; margin-bottom: 1rem;">Third-Party Links</h2>
      <p style="margin-bottom: 1rem;">
        Our website may include links to third-party websites, plug-ins, and applications. Clicking on those links
        may allow third parties to collect or share data about you. We do not control these third-party websites
        and are not responsible for their privacy statements.
      </p>
    </section>

    <section style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.5rem; font-weight: 600; color: #111827; margin-bottom: 1rem;">Changes to This Privacy Policy</h2>
      <p style="margin-bottom: 1rem;">
        We may update our privacy policy from time to time. We will notify you of any changes by posting the new
        privacy policy on this page and updating the "Last updated" date at the top of this privacy policy.
      </p>
    </section>

    <section style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.5rem; font-weight: 600; color: #111827; margin-bottom: 1rem;">Contact Us</h2>
      <p style="margin-bottom: 1rem;">
        If you have any questions about this privacy policy or our privacy practices, please contact us at:
      </p>
      <div style="background-color: #F3F4F6; padding: 1rem; border-radius: 8px; margin-top: 1rem;">
        <p style="margin: 0; color: #374151;">
          <strong>Email:</strong> <a href="mailto:privacy@{{store_name}}.com" style="color: #2563EB; text-decoration: none;">privacy@{{store_name}}.com</a>
        </p>
      </div>
    </section>
  </div>
</div>
`;

const defaultPrivacyPolicyMetadata = {
  meta_title: "Privacy Policy | {{store_name}}",
  meta_description: "Learn how {{store_name}} collects, uses, and protects your personal information. Read our privacy policy for details on data protection and your rights.",
  meta_keywords: "privacy policy, data protection, personal information, privacy rights, GDPR",
  meta_robots_tag: "index, follow"
};

// Dutch translation
const defaultPrivacyPolicyContentNL = `
<div style="max-width: 900px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;">
  <h1 style="font-size: 2.5rem; font-weight: bold; color: #111827; margin-bottom: 1.5rem; border-bottom: 3px solid #2563EB; padding-bottom: 0.5rem;">
    Privacybeleid
  </h1>

  <p style="color: #6B7280; margin-bottom: 2rem; font-size: 0.95rem;">
    <em>Laatst bijgewerkt: ${new Date().toLocaleDateString('nl-NL')}</em>
  </p>

  <div style="line-height: 1.8; color: #374151;">
    <section style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.5rem; font-weight: 600; color: #111827; margin-bottom: 1rem;">Introductie</h2>
      <p style="margin-bottom: 1rem;">
        Welkom bij {{store_name}}. Wij respecteren uw privacy en zijn toegewijd aan het beschermen van uw persoonlijke gegevens.
        Dit privacybeleid informeert u over hoe wij met uw persoonlijke gegevens omgaan wanneer u onze website bezoekt
        en vertelt u over uw privacyrechten en hoe de wet u beschermt.
      </p>
    </section>

    <section style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.5rem; font-weight: 600; color: #111827; margin-bottom: 1rem;">Informatie die wij verzamelen</h2>
      <p style="margin-bottom: 0.5rem;">Wij kunnen verschillende soorten persoonlijke gegevens over u verzamelen, gebruiken, opslaan en overdragen:</p>
      <ul style="margin-left: 1.5rem; margin-bottom: 1rem;">
        <li style="margin-bottom: 0.5rem;"><strong>Identiteitsgegevens:</strong> Naam, gebruikersnaam of vergelijkbare identificatie</li>
        <li style="margin-bottom: 0.5rem;"><strong>Contactgegevens:</strong> E-mailadres, telefoonnummer, facturatie- en bezorgadressen</li>
        <li style="margin-bottom: 0.5rem;"><strong>Transactiegegevens:</strong> Details over betalingen en producten die u bij ons hebt gekocht</li>
        <li style="margin-bottom: 0.5rem;"><strong>Technische gegevens:</strong> IP-adres, browsertype, tijdzone-instelling en locatie</li>
        <li style="margin-bottom: 0.5rem;"><strong>Gebruiksgegevens:</strong> Informatie over hoe u onze website en diensten gebruikt</li>
        <li style="margin-bottom: 0.5rem;"><strong>Marketinggegevens:</strong> Uw voorkeuren voor het ontvangen van marketing van ons</li>
      </ul>
    </section>

    <section style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.5rem; font-weight: 600; color: #111827; margin-bottom: 1rem;">Hoe wij uw informatie gebruiken</h2>
      <p style="margin-bottom: 0.5rem;">Wij gebruiken uw persoonlijke gegevens voor de volgende doeleinden:</p>
      <ul style="margin-left: 1.5rem; margin-bottom: 1rem;">
        <li style="margin-bottom: 0.5rem;">Om uw bestellingen te verwerken en te leveren</li>
        <li style="margin-bottom: 0.5rem;">Om uw account te beheren en klantenondersteuning te bieden</li>
        <li style="margin-bottom: 0.5rem;">Om onze website, producten en diensten te verbeteren</li>
        <li style="margin-bottom: 0.5rem;">Om u marketingcommunicatie te sturen (met uw toestemming)</li>
        <li style="margin-bottom: 0.5rem;">Om te voldoen aan wettelijke verplichtingen</li>
      </ul>
    </section>

    <section style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.5rem; font-weight: 600; color: #111827; margin-bottom: 1rem;">Cookies</h2>
      <p style="margin-bottom: 1rem;">
        Wij gebruiken cookies en vergelijkbare trackingtechnologieën om activiteiten op onze website bij te houden en bepaalde informatie op te slaan.
        U kunt uw browser instrueren om alle cookies te weigeren of aan te geven wanneer een cookie wordt verzonden.
        Als u echter geen cookies accepteert, kunt u mogelijk niet alle delen van onze website gebruiken.
      </p>
      <p style="margin-bottom: 1rem;">
        Voor meer informatie over de cookies die wij gebruiken, zie onze Cookie-toestemmingsbanner wanneer u onze website voor het eerst bezoekt.
      </p>
    </section>

    <section style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.5rem; font-weight: 600; color: #111827; margin-bottom: 1rem;">Gegevensbeveiliging</h2>
      <p style="margin-bottom: 1rem;">
        Wij hebben passende beveiligingsmaatregelen getroffen om te voorkomen dat uw persoonlijke gegevens per ongeluk verloren gaan,
        gebruikt worden of op ongeoorloofde wijze worden geopend. Wij beperken de toegang tot uw persoonlijke gegevens tot werknemers, agenten,
        aannemers en andere derden die een zakelijke noodzaak hebben om dit te weten.
      </p>
    </section>

    <section style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.5rem; font-weight: 600; color: #111827; margin-bottom: 1rem;">Uw rechten</h2>
      <p style="margin-bottom: 0.5rem;">Onder de wetgeving op het gebied van gegevensbescherming heeft u rechten, waaronder:</p>
      <ul style="margin-left: 1.5rem; margin-bottom: 1rem;">
        <li style="margin-bottom: 0.5rem;"><strong>Recht op toegang:</strong> Vraag toegang tot uw persoonlijke gegevens</li>
        <li style="margin-bottom: 0.5rem;"><strong>Recht op rectificatie:</strong> Vraag correctie van onjuiste gegevens</li>
        <li style="margin-bottom: 0.5rem;"><strong>Recht op verwijdering:</strong> Vraag verwijdering van uw persoonlijke gegevens</li>
        <li style="margin-bottom: 0.5rem;"><strong>Recht op beperking van verwerking:</strong> Vraag beperking van de verwerking</li>
        <li style="margin-bottom: 0.5rem;"><strong>Recht op gegevensoverdraagbaarheid:</strong> Vraag overdracht van uw gegevens</li>
        <li style="margin-bottom: 0.5rem;"><strong>Recht van bezwaar:</strong> Bezwaar maken tegen de verwerking van uw persoonlijke gegevens</li>
      </ul>
    </section>

    <section style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.5rem; font-weight: 600; color: #111827; margin-bottom: 1rem;">Links naar derden</h2>
      <p style="margin-bottom: 1rem;">
        Onze website kan links naar websites van derden, plug-ins en applicaties bevatten. Door op die links te klikken
        kunnen derden gegevens over u verzamelen of delen. Wij hebben geen controle over deze websites van derden
        en zijn niet verantwoordelijk voor hun privacyverklaringen.
      </p>
    </section>

    <section style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.5rem; font-weight: 600; color: #111827; margin-bottom: 1rem;">Wijzigingen in dit privacybeleid</h2>
      <p style="margin-bottom: 1rem;">
        Wij kunnen ons privacybeleid van tijd tot tijd bijwerken. Wij zullen u op de hoogte stellen van eventuele wijzigingen door het nieuwe
        privacybeleid op deze pagina te plaatsen en de datum "Laatst bijgewerkt" bovenaan dit privacybeleid bij te werken.
      </p>
    </section>

    <section style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.5rem; font-weight: 600; color: #111827; margin-bottom: 1rem;">Contact opnemen</h2>
      <p style="margin-bottom: 1rem;">
        Als u vragen heeft over dit privacybeleid of onze privacypraktijken, neem dan contact met ons op via:
      </p>
      <div style="background-color: #F3F4F6; padding: 1rem; border-radius: 8px; margin-top: 1rem;">
        <p style="margin: 0; color: #374151;">
          <strong>E-mail:</strong> <a href="mailto:privacy@{{store_name}}.com" style="color: #2563EB; text-decoration: none;">privacy@{{store_name}}.com</a>
        </p>
      </div>
    </section>
  </div>
</div>
`;

const defaultPrivacyPolicyMetadataNL = {
  meta_title: "Privacybeleid | {{store_name}}",
  meta_description: "Leer hoe {{store_name}} uw persoonlijke informatie verzamelt, gebruikt en beschermt. Lees ons privacybeleid voor details over gegevensbescherming en uw rechten.",
  meta_keywords: "privacybeleid, gegevensbescherming, persoonlijke informatie, privacyrechten, AVG",
  meta_robots_tag: "index, follow"
};

module.exports = {
  defaultPrivacyPolicyContent,
  defaultPrivacyPolicyMetadata,
  defaultPrivacyPolicyContentNL,
  defaultPrivacyPolicyMetadataNL
};
