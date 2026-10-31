import type { Metadata } from "next";
import { CheckoutButton, SignInButton } from "@/components/BillingAction";
import { environment, billingReady } from "@/lib/cloudflare";

export const dynamic="force-dynamic";
const pricingTitle="Pricing — 10 Free Credits, Pro from $9/mo | Pixform";
const pricingDescription="10 free credits to start, then Pro from $9/mo or one-time packs from $9. Image to Image costs 1 credit, AI Face Swap 2. Cancel anytime.";
export const metadata:Metadata={title:pricingTitle,description:pricingDescription,alternates:{canonical:"/pricing"}};

const pricingFaqs = [
  ["How many credits does each Pixform tool use?", "Image to Image uses 1 credit for each generation. Face Swap uses 2 credits because it processes and blends two uploaded photos."],
  ["What happens when a generation fails?", "Credits are reserved before generation and automatically returned if Pixform cannot complete and save the result."],
  ["Do the 10 free credits expire?", "The welcome credits are issued once after you sign in. They remain in your permanent balance and do not expire."],
  ["Do one-time credit packs expire?", "No. Credits from the 200-credit and 700-credit packs stay in your permanent balance until you use them."],
  ["What happens to subscription credits?", "Monthly credits reset on each paid renewal. Annual credits are issued after payment and expire at the end of the annual term. Subscription credits are used before permanent credits."],
  ["How do I cancel a subscription?", "Open your Pixform account and choose Manage billing. Cancellation takes effect at the end of the current paid term, so you can use the remaining subscription credits until then."],
  ["Can I get a refund?", "Your first Pro purchase or credit pack may be eligible within seven days only if none of its paid credits have been used. Renewals, partial use and older purchases are generally non-refundable, except where law or an erroneous charge requires otherwise."],
  ["Are taxes included in the listed price?", "Prices are listed in USD before tax. Stripe calculates and displays any applicable tax and supported local-currency conversion before you confirm payment."],
] as const;

export default async function Pricing(){let enabled=false;try{enabled=billingReady(await environment());}catch{}
  const offers=[
    ["Free","$0","10 credits once","Sign in with Google and explore eligible Pixform tools.",null],
    ["Pro Monthly","$9 / month","300 credits each paid month","Unused subscription credits reset on each paid renewal.","pro_monthly_v1"],
    ["Pro Annual","$86 / year","3,600 credits for the annual term","Issued after payment and expires at the end of the annual term.","pro_yearly_v1"],
    ["Credits 200","$9 once","200 permanent credits","One-time pack. Credits do not expire.","credits_200_v1"],
    ["Credits 700","$25 once","700 permanent credits","One-time pack. Credits do not expire.","credits_700_v1"],
  ] as const;
  const schema=[
    {"@context":"https://schema.org","@type":"WebPage","@id":"https://pixform.ai/pricing#webpage",url:"https://pixform.ai/pricing",name:pricingTitle,description:pricingDescription,isPartOf:{"@type":"WebSite","@id":"https://pixform.ai/#website",url:"https://pixform.ai/",name:"Pixform"}},
    {"@context":"https://schema.org","@type":"FAQPage",mainEntity:pricingFaqs.map(([name,text])=>({"@type":"Question",name,acceptedAnswer:{"@type":"Answer",text}}))},
    {"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"Home",item:"https://pixform.ai/"},{"@type":"ListItem",position:2,name:"Pricing",item:"https://pixform.ai/pricing"}]},
  ];
  return <main id="main" className="pricing wrap"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/><div className="section-label">SIMPLE CREDITS. CLEAR COSTS.</div><h1>Choose how you create.</h1><p className="pricing-intro">Start with 10 free credits, then choose a plan that fits how often you create. Image to Image costs 1 credit and Face Swap costs 2 credits.</p>
    <div className="price-grid">{offers.map(([name,price,credits,detail,key])=><article key={name} className={name==="Pro Annual"?"featured":""}><span className="live-label">{name==="Pro Annual"?"SAVE 20%":"PIXFORM"}</span><h2>{name}</h2><p className="price">{price}</p><strong>{credits}</strong><p>{detail}</p>{key?<CheckoutButton offerKey={key} disabled={!enabled}>{enabled?"Choose plan":"Opening soon"}</CheckoutButton>:enabled?<SignInButton>Get started free</SignInButton>:<button className="dark-button" disabled>Opening soon</button>}</article>)}</div>
    <p className="tax-note">Prices are in USD. Stripe shows any applicable tax and currency conversion before payment. Cancel subscriptions from your account; cancellation takes effect at the end of the current paid term.</p>
    <section className="pricing-guide" aria-labelledby="credits-work"><div><div className="section-label">ONE BALANCE, TWO TOOLS</div><h2 id="credits-work">How Pixform credits work.</h2><p>Credits make the cost of every generation clear before you start. Pixform reserves the required amount while the model runs and returns it automatically if the generation fails. A successful result is charged once; downloading it does not use another credit.</p></div><div className="pricing-table-wrap"><table><caption className="visually-hidden">Credit use by Pixform tool</caption><thead><tr><th>Tool</th><th>Cost</th><th>What you create</th></tr></thead><tbody><tr><th>Image to Image</th><td data-label="Cost">1 credit</td><td data-label="What you create">One styled image from one upload</td></tr><tr><th>AI Face Swap</th><td data-label="Cost">2 credits</td><td data-label="What you create">One face-swap result from two uploads</td></tr></tbody></table><p className="table-note">Subscription credits are used first. Permanent credits from your welcome balance or a pack remain available afterward.</p></div></section>
    <section className="pricing-guide" aria-labelledby="choose-credit-plan"><div><div className="section-label">CHOOSE FOR YOUR ROUTINE</div><h2 id="choose-credit-plan">Pro or a credit pack?</h2><p>Choose Pro when you create regularly and want a larger recurring allowance. Choose a one-time pack when your use is occasional or project-based. Both options use the same balance across eligible Pixform tools.</p></div><div className="pricing-table-wrap"><table><caption className="visually-hidden">Comparison of Pixform plans and credit packs</caption><thead><tr><th>Option</th><th>Credits</th><th>Best for</th><th>Validity</th></tr></thead><tbody><tr><th>Free</th><td data-label="Credits">10 once</td><td data-label="Best for">Trying both tools</td><td data-label="Validity">Does not expire</td></tr><tr><th>Pro Monthly</th><td data-label="Credits">300/month</td><td data-label="Best for">Regular creation</td><td data-label="Validity">Resets each renewal</td></tr><tr><th>Pro Annual</th><td data-label="Credits">3,600/year</td><td data-label="Best for">Consistent higher use</td><td data-label="Validity">Annual term</td></tr><tr><th>Credit packs</th><td data-label="Credits">200 or 700</td><td data-label="Best for">Flexible projects</td><td data-label="Validity">Does not expire</td></tr></tbody></table></div></section>
    <section className="free-tier"><div className="section-label">START BEFORE YOU PAY</div><h2>Explore with the free tier.</h2><p>Sign in with Google and Pixform adds 10 welcome credits to your permanent balance. A credit card is not required. That is enough for ten Image to Image generations, five Face Swaps or a mix of both. When the balance runs low, return here to add a permanent pack or subscribe to Pro. You can always review your remaining credits and billing access from your account.</p></section>
    <section className="faq"><div><div className="section-label">BILLING QUESTIONS</div><h2>Know before you buy.</h2></div><div>{pricingFaqs.map(([q,a])=><details key={q}><summary>{q}<span aria-hidden>+</span></summary><p>{a}</p></details>)}</div></section>
  </main>;
}
