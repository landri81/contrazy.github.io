export type NavItem = {
  href: string
  label: string
}

export type Stat = {
  label: string
  value: string
  detail: string
}

export type WorkflowStep = {
  step: string
  title: string
  description: string
}

export type FeatureCard = {
  title: string
  description: string
  tag?: string
  image?: string
}

export type PricingTier = {
  name: string
  monthly: string
  yearly: string
  subtitle: string
  highlight?: boolean
  items: string[]
}

export type FaqItem = {
  question: string
  answer: string
}

export type ContentSection = {
  title: string
  paragraphs: readonly string[]
  bullets?: readonly string[]
}

export const siteNav: NavItem[] = [
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
  { href: "/demo", label: "Demo" },
]

export const footerGroups = [
  {
    title: "Product",
    links: [
      { href: "/pricing", label: "Pricing" },
      { href: "/demo", label: "Demo" },
      { href: "/api-docs", label: "Platform guide" },
      { href: "/status", label: "Status" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/help", label: "Help Center" },
      { href: "/faq", label: "FAQ" },
      { href: "/contact", label: "Contact" },
      { href: "/blog", label: "Blog" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/terms", label: "Terms" },
      { href: "/legal/privacy", label: "Privacy" },
      { href: "/legal/gdpr", label: "GDPR" },
      { href: "/legal/imprint", label: "Imprint" },
    ],
  },
] as const

export const heroStats: Stat[] = [
  {
    label: "Identity checks",
    value: "98%",
    detail: "Completion rate across guided customer journeys.",
  },
  {
    label: "Active workflows",
    value: "23",
    detail: "Customer journeys managed from one shared platform.",
  },
  {
    label: "Average completion",
    value: "14m",
    detail: "From secure link open to signed agreement in the sample flow.",
  },
  {
    label: "Deposit coverage",
    value: "8.4k EUR",
    detail: "Visible from the same account view as payments and agreements.",
  },
]

export const trustSignals = [
  "Business setup, agreements, and payments in one place",
  "Secure customer links with clear step-by-step progress",
  "Separate workspaces for vendors and internal review",
]

export const workflowSteps: WorkflowStep[] = [
  {
    step: "01",
    title: "Vendor creates a workspace",
    description: "Business profile, approval status, and Stripe connection are handled from one setup path.",
  },
  {
    step: "02",
    title: "Transaction requirements are defined",
    description: "Templates, document requirements, payment amount, and deposit rules are attached to a single workflow.",
  },
  {
    step: "03",
    title: "A secure link is generated",
    description: "The vendor sends one secure link or QR code instead of juggling separate tools and messages.",
  },
  {
    step: "04",
    title: "The client completes onboarding",
    description: "Profile details, optional KYC, documents, contract review, and signature happen inside one guided journey.",
  },
  {
    step: "05",
    title: "Payment and deposit are processed",
    description: "Service payment and deposit authorization stay traceable alongside the rest of the transaction state.",
  },
  {
    step: "06",
    title: "The vendor monitors the result",
    description: "Progress, alerts, disputes, and follow-up actions stay aligned on the same record.",
  },
]

export const productModules: FeatureCard[] = [
  {
    title: "Vendor onboarding",
    description: "Business profile, approval status, and payout readiness in one clean setup flow.",
    tag: "Setup",
    image: "/images/img-connect.jpg",
  },
  {
    title: "Identity and document collection",
    description: "Optional identity checks, requested files, and transaction-specific evidence handled without leaving the flow.",
    tag: "Verification",
    image: "/images/img-identity.jpg",
  },
  {
    title: "Contract and signature",
    description: "Reusable contract templates, checklist requirements, and simple signature capture tied to the same transaction.",
    tag: "Contracts",
    image: "/images/img-auth.jpg",
  },
  {
    title: "Payment and deposit controls",
    description: "Collect service payments, authorize deposits, and later capture or release them with full timeline visibility.",
    tag: "Finance",
    image: "/images/img-billing.jpg",
  },
  {
    title: "Operational dashboards",
    description: "Dedicated spaces for vendors and internal teams keep reviews, activity, and follow-up work organized.",
    tag: "Oversight",
    image: "/images/img-postgres.jpg",
  },
  {
    title: "Activity and support visibility",
    description: "Important account events, payment updates, and support follow-up stay visible in one place.",
    tag: "Operations",
    image: "/images/img-webhooks.jpg",
  },
]

export const useCases: FeatureCard[] = [
  {
    title: "Car rental",
    description: "Collect driving documents, signatures, payment, and deposit authorization before handover.",
  },
  {
    title: "Hospitality",
    description: "Run pre-arrival identity checks, terms acceptance, and payment collection from one client link.",
  },
  {
    title: "Property and real estate",
    description: "Track documents, rental terms, and deposit flows without fragmenting the onboarding process.",
  },
  {
    title: "Service agreements",
    description: "Capture client information, signatures, and staged billing in one structured workflow.",
  },
]

export const pricingTiers: PricingTier[] = [
  {
    name: "Starter",
    monthly: "EUR 49",
    yearly: "EUR 470",
    subtitle: "Foundational launch stack for early vendors.",
    items: [
      "Business setup and account review",
      "Customer agreements and document requests",
      "Core dashboard access for early launches",
    ],
  },
  {
    name: "Growth",
    monthly: "EUR 129",
    yearly: "EUR 1,250",
    subtitle: "For teams running live transaction operations.",
    highlight: true,
    items: [
      "Full customer workflow from link to payment",
      "Internal review, invites, and account activity",
      "Dashboards for payments, deposits, and disputes",
    ],
  },
  {
    name: "Scale",
    monthly: "Custom",
    yearly: "Custom",
    subtitle: "For higher-volume or multi-team deployments.",
    items: [
      "Extended oversight and reporting needs",
      "Custom launch support for complex workflows",
      "Planning for multi-team growth",
    ],
  },
]

export const blogPosts = [
  {
    title: "Designing a single-link client workflow",
    description: "Why Conntrazy keeps identity, document collection, contracts, and payment on the same transaction record.",
    category: "Product",
    date: "May 1, 2026",
  },
  {
    title: "When identity checks should be optional",
    description: "How to keep customer onboarding flexible across different industries and risk levels.",
    category: "Operations",
    date: "April 26, 2026",
  },
  {
    title: "What a strong vendor review flow looks like",
    description: "The account details, approval steps, and payout readiness signals that matter before launch.",
    category: "Guides",
    date: "April 22, 2026",
  },
]

export const faqItems: FaqItem[] = [
  {
    question: "Does the client need a full account?",
    answer: "No. Most customers can complete the required steps from a secure link without creating a full account first.",
  },
  {
    question: "Is KYC mandatory for every vendor flow?",
    answer: "No. Identity checks are optional and can be enabled only where the vendor needs stronger verification rules.",
  },
  {
    question: "How are contracts handled?",
    answer: "Vendors manage reusable contract templates in their workspace. Transactions attach those templates and guide the client through review and signature.",
  },
  {
    question: "Can deposits be released later?",
    answer: "Yes. The flow is designed around authorization first, then later release or capture depending on the outcome of the transaction.",
  },
  {
    question: "Who can access the admin area?",
    answer: "Approved internal team members and the platform owner can access the admin area. Vendor workspaces stay separate.",
  },
  {
    question: "Is this a live product or still a concept?",
    answer: "Conntrazy is being built as a working product. Public pages, sign-in, vendor setup, and protected workspaces are all part of the live application foundation.",
  },
]

export const helpSections = [
  {
    title: "Vendor onboarding",
    paragraphs: [
      "Create your vendor account, complete the business profile, and wait for admin approval if your workspace requires review.",
      "Once approved, connect Stripe and set your reusable contract and checklist defaults before sending any client links.",
    ],
    bullets: [
      "Register with email and password or continue with Google",
      "Complete business name, email, phone, and support settings",
      "Connect Stripe from the vendor finance area",
    ],
  },
  {
    title: "Transaction setup",
    paragraphs: [
      "Each transaction is its own workspace. Attach the right contract template, document requirements, and payment settings before sharing the link.",
    ],
    bullets: [
      "Choose the transaction kind",
      "Set payment amount and optional deposit amount",
      "Decide whether KYC is required",
    ],
  },
  {
    title: "Client flow",
    paragraphs: [
      "The customer journey moves through profile, identity checks when required, documents, agreement review, signature, payment, and confirmation.",
      "Each step stays clear for the customer while giving the vendor full visibility from the dashboard.",
    ],
  },
  {
    title: "Admin operations",
    paragraphs: [
      "Admins can review accounts, invitations, account activity, payout readiness, and support issues without mixing those concerns into vendor pages.",
    ],
  },
]

export const apiSections = [
  {
    title: "Getting started",
    paragraphs: [
      "Conntrazy starts with secure sign-in, business setup, and a review-ready vendor profile.",
      "The first goal is to make it easy for a team to open an account and move into a working customer flow.",
    ],
  },
  {
    title: "Business review",
    paragraphs: [
      "Internal teams can review business details, check account readiness, and decide when a vendor is ready for live use.",
    ],
  },
  {
    title: "Customer journey",
    paragraphs: [
      "Every customer flow keeps profile details, requested documents, agreements, signatures, payments, and deposits connected in one record.",
    ],
  },
  {
    title: "Payments and follow-up",
    paragraphs: [
      "Payment readiness, deposit follow-up, and account activity remain visible in one place so teams can act quickly when something needs attention.",
    ],
  },
]

export const statusCards = [
  {
    title: "Sign-in",
    description: "Operational",
    tag: "Green",
  },
  {
    title: "Payments",
    description: "Operational",
    tag: "Green",
  },
  {
    title: "Document intake",
    description: "Operational",
    tag: "Green",
  },
  {
    title: "Email delivery",
    description: "Monitoring",
    tag: "Amber",
  },
]

export const legalDocuments = {
  terms: [
    {
      title: "Service scope",
      paragraphs: [
        "Conntrazy provides a workflow platform for vendor onboarding, document collection, contract handling, signature, payment, and deposit operations.",
        "Conntrazy is designed to centralize these steps, not to replace legal counsel or regulated financial advice.",
      ],
    },
    {
      title: "Account responsibilities",
      paragraphs: [
        "Vendors are responsible for the accuracy of the information, templates, and requirements configured in their workspace.",
        "Sign-in details must be kept secure and account access must be managed responsibly.",
      ],
    },
    {
      title: "Payments and deposits",
      paragraphs: [
        "Payment processing and deposit authorization rely on Stripe services and are subject to Stripe's operating rules and fees.",
      ],
    },
  ],
  privacy: [
    {
      title: "Collected data",
      paragraphs: [
        "Conntrazy processes account information, business profile data, client onboarding data, uploaded documents, contract metadata, payment references, and operational logs.",
      ],
      bullets: [
        "User account identifiers",
        "Business and client contact data",
        "Document and transaction metadata",
      ],
    },
    {
      title: "Processors",
      paragraphs: [
        "Conntrazy relies on trusted service partners for account access, file handling, email delivery, and payment services. Data processing stays limited to the product workflow and supporting operations.",
      ],
    },
  ],
  gdpr: [
    {
      title: "Data subject rights",
      paragraphs: [
        "Individuals may request access, correction, deletion, and processing clarification where those rights apply.",
      ],
    },
    {
      title: "Retention approach",
      paragraphs: [
        "Operational records are kept only as long as the product workflow, compliance needs, or support obligations require.",
      ],
    },
  ],
  imprint: [
    {
      title: "Company information",
      paragraphs: [
        "Conntrazy is presented here as a software platform for vendor-to-client transaction workflows.",
        "Final production company information, registered address, and jurisdiction details should be confirmed before launch.",
      ],
    },
    {
      title: "Support",
      paragraphs: [
        "For product or compliance questions, direct support requests through the contact page and designated operational email channels.",
      ],
    },
  ],
} as const

export const contactChannels = [
  {
    title: "Sales and product",
    description: "Use this page for pilot discussions, workflow fit, and launch planning.",
  },
  {
    title: "Support",
    description: "Route issues with onboarding, documents, payment state, or dashboard usage through the support path.",
  },
  {
    title: "Partnerships",
    description: "Use cases across hospitality, rentals, and service workflows can be reviewed here.",
  },
]
