import { ArrowDown, ArrowRight, MapPin, Route } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function DashboardPage() {
  return (
    <main className="landing">
      <section className="landing-panel landing-pale">
          <div className="landing-copy landing-reveal">
            <p className="eyebrow emerald">LIVE • EXPLAINABLE • OPEN DATA</p>
            <h2>Go farther.<br />Charge <em>smarter.</em></h2>
            <p>Choose your EV, compare real road routes and find useful charging stations along the way.</p>
            <div className="hero-actions"><Link className="button primary" to="/plan">Plan a journey <ArrowRight size={17} /></Link><Link className="button ghost" to="/sources">See our data</Link></div>
          </div>
          <div className="landing-route-art" aria-hidden="true"><Route /><span /><MapPin /></div>
          <a className="scroll-cue" href="#network"><span>Explore network</span><ArrowDown /></a>
      </section>
      <section id="network" className="landing-panel landing-emerald">
        <div className="landing-network-art" aria-hidden="true"><span /><span /><span /></div>
        <div className="landing-copy landing-reveal delay"><p className="eyebrow">THE NETWORK, UNCOVERED</p><h2>Real stations.<br />Real routes.</h2><p>Search nearby charging infrastructure or start with a complete EV-aware journey.</p><div className="hero-actions"><Link className="button pale-button" to="/network">Nearest charging station <ArrowRight /></Link><Link className="button outline-pale" to="/plan">Plan a journey</Link></div></div>
      </section>
    </main>
  )
}
