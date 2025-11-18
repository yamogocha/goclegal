export const attorneySchema = {
"@context": "https://schema.org",
"@type": "Person",
"name": "Gregory OConnell",
"jobTitle": "Personal Injury Attorney",
"image": "https://cdn.sanity.io/images/3zonvthd/production/b8dd1ce3b6f2ca364579a5e5ac4f5f5907b184b2-3024x4032.jpg",
"worksFor": {
    "@type": "LegalService",
    "name": "GOC Legal"
},
"sameAs": [
    "https://www.linkedin.com/in/gregory-o-connell-a89ba43a/"
],
"description": "Gregory OConnell specializes in personal injury cases in Oakland, CA."
};

export const faqSchema = {
"@context": "https://schema.org",
"@type": "FAQPage",
"mainEntity": [
    {
    "@type": "Question",
    "name": "How much does a personal injury consultation cost?",
    "acceptedAnswer": {
        "@type": "Answer",
        "text": "GOC Legal offers free consultations for personal injury cases."
    }
    },
    {
    "@type": "Question",
    "name": "Does GOC Legal work on a contingency basis?",
    "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, GOC Legal charges zero upfront fees and works on a contingency basis."
    }
    }
]
};

export const homepageSchema = {
"@context": "https://schema.org",
"@type": "LegalService",
"name": "GOC Legal",
"url": "https://www.goclegal.com",
"logo": "https://res.cloudinary.com/dre1b2zmh/image/upload/v1705945101/goclegal/favicon-logo.png",
"image": "https://res.cloudinary.com/dre1b2zmh/image/upload/v1705782311/goclegal/sfcitybgdesktop.webp",
"description": "GOC Legal is a trusted Oakland personal injury and auto accident law firm. Zero upfront fees, maximum compensation, and free consultations.",
"telephone": "+1-510-846-0928",
"address": {
    "@type": "PostalAddress",
    "streetAddress": "10 Villanova Drive",
    "addressLocality": "Oakland",
    "addressRegion": "CA",
    "postalCode": "94611",
    "addressCountry": "US"
},
"areaServed": "Oakland",
"openingHours": "Mo-Fr 09:00-17:00",
"sameAs": [
    "https://www.facebook.com/goclegal",
    "https://www.linkedin.com/company/goclegal",
    "https://www.instagram.com/goclegalpc/"
]
};

export const testimonialSchema = {
"@context": "https://schema.org",
"@type": "LegalService",
"name": "GOC Legal",
"aggregateRating": {
  "@type": "AggregateRating",
  "ratingValue": "5",
  "ratingCount": "4"
},
"review": [
    {
    "@type": "Review",
    "author": { "@type": "Person", "name": "Grace Lee" },
    "reviewBody": "I was scared and confused after my injury, but GOC Legal gave me peace of mind. They listened, cared, and fought for me. It wasn’t just about the money. It was about justice and being treated with respect. I’ll always be grateful.",
    },
    {
    "@type": "Review",
    "author": { "@type": "Person", "name": "Brendon Smith" },
    "reviewBody": "After my accident, I was overwhelmed and didn’t know where to start. The team at GOC Legal took care of everything, from dealing with the insurance company to getting me the settlement I deserved. They treated me like family, not just another case. Highly recommend!",
    }
]
};

const getPracticeAreaSchema = (areaName: string, description: string, url: string) => ({
"@context": "https://schema.org",
"@type": "Service",
"name": areaName,
"description": description,
"provider": {
    "@type": "LegalService",
    "name": "GOC Legal",
    "url": "https://www.goclegal.com"
},
"areaServed": {
    "@type": "City",
    "name": "Oakland"
},
"url": url
});

export const autoAccidentsSchema = getPracticeAreaSchema(
"Auto Accidents",
"GOC Legal helps clients get maximum compensation for auto accident injuries in Oakland, CA.",
"https://www.goclegal.com/auto-accidents"
);

export const bicycleAccidentsSchema = getPracticeAreaSchema(
"Bicycle Accidents",
"GOC Legal represents clients injured in bicycle accidents in Oakland, CA, to get fair compensation.",
"https://www.goclegal.com/bicycle-accidents"
);

export const truckingAccidentsSchema = getPracticeAreaSchema(
"Trucking Accidents",
"GOC Legal helps victims of trucking accidents navigate legal claims and secure maximum compensation.",
"https://www.goclegal.com/trucking-accidents"
);

export const constructionAccidentsSchema = getPracticeAreaSchema(
"Construction Site Accidents",
"GOC Legal assists workers injured on construction sites in Oakland, CA, with legal claims.",
"https://www.goclegal.com/construction-site-accidents"
);

export const wrongfulDeathSchema = getPracticeAreaSchema(
"Wrongful Death",
"GOC Legal provides compassionate legal representation for wrongful death cases in Oakland, CA.",
"https://www.goclegal.com/wrongful-death"
);

export const slipFallSchema = getPracticeAreaSchema(
"Slip and Fall Injuries",
"GOC Legal helps clients injured in slip and fall accidents pursue compensation in Oakland, CA.",
"https://www.goclegal.com/slip-and-fall-injuries"
);

export const traumaticBrainInjurySchema = getPracticeAreaSchema(
    "Traumatic Brain Injury",
    "GOC Legal represents victims of traumatic brain injuries in Oakland, CA, helping them secure full compensation for medical costs, lost wages, and long-term care.",
    "https://www.goclegal.com/traumatic-brain-injury"
  );


const BASE_URL = "https://www.goclegal.com";

export function buildPageMetadata({
title,
description,
path,
}: {
title: string;
description: string;
path: string;
}) {
const url = `${BASE_URL}${path.startsWith("/") ? path : "/" + path}`;

return {
    title,
    description,
    alternates: {
    canonical: url,
    },
    openGraph: {
    title,
    description,
    url,
    siteName: "GOC Legal",
    type: "website",
    },
};
}
  