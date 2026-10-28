import type { Metadata } from "next";
import { CheckoutButton, SignInButton } from "@/components/BillingAction";
import { environment, billingReady } from "@/lib/cloudflare";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Pricing — AI Image Credits | Pixform",description:"Choose Pixform Pro or add credits for image transformations and face swaps.",alternates:{canonical:"/pricing"}};
export default async function Pricing(){let enabled=false;try{enabled=billingReady(await environment());}catch{}
  const offers=[
    ["Free","$0","10 credits once","Sign in with Google and explore eligible Pixform tools.",null],
    ["Pro Monthly","$9 / month","300 credits each paid month","Unused subscription credits reset on each paid renewal.","pro_monthly_v1"],
    ["Pro Annual","$86 / year","3,600 credits for the annual term","Issued after payment and expires at the end of the annual term.","pro_yearly_v1"],
    ["Credits 200","$9 once","200 permanent credits","One-time pack. Credits do not expire.","credits_200_v1"],
    ["Credits 700","$25 once","700 permanent credits","One-time pack. Credits do not expire.","credits_700_v1"],
  ] as const;
  const schema={"@context":"https://schema.org","@type":"Product",name:"Pixform credits",offers:offers.slice(1).map(o=>({"@type":"Offer",price:o[1].match(/[\d.]+/)?.[0],priceCurrency:"USD",availability:enabled?"https://schema.org/InStock":"https://schema.org/PreOrder"}))};
  return <main id="main" className="pricing wrap"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/><div className="section-label">SIMPLE CREDITS. CLEAR COSTS.</div><h1>Choose how you create.</h1><p className="pricing-intro">Image to Image costs 1 credit. Face Swap costs 2 credits. Subscription credits are used first, then permanent credits.</p>
    <div className="price-grid">{offers.map(([name,price,credits,detail,key])=><article key={name} className={name==="Pro Annual"?"featured":""}><span className="live-label">{name==="Pro Annual"?"SAVE 20%":"PIXFORM"}</span><h2>{name}</h2><p className="price">{price}</p><strong>{credits}</strong><p>{detail}</p>{key?<CheckoutButton offerKey={key} disabled={!enabled}>{enabled?"Choose plan ↗":"Opening soon"}</CheckoutButton>:enabled?<SignInButton>Get started free ↗</SignInButton>:<button className="dark-button" disabled>Opening soon</button>}</article>)}</div>
    <p className="tax-note">Prices are in USD. Taxes may be added at checkout. Cancel subscriptions before renewal from your account; cancellation takes effect at the end of the current term.</p>
    <section className="faq"><div><div className="section-label">BILLING QUESTIONS</div><h2>Know before you buy.</h2></div><div><details><summary>What happens when a generation fails?<span>+</span></summary><p>Credits are reserved before generation and automatically returned if Pixform cannot complete and save the result.</p></details><details><summary>Can I get a refund?<span>+</span></summary><p>Your first Pro purchase or credit pack may be eligible within seven days only if none of its paid credits have been used. Renewals, partial use and purchases older than seven days are generally non-refundable, except where law or an erroneous charge requires otherwise.</p></details><details><summary>Do purchased credits expire?<span>+</span></summary><p>One-time packs do not expire. Monthly subscription credits reset on each paid renewal. Annual subscription credits expire at the end of the annual term.</p></details></div></section>
  </main>;
}
