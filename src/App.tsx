/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { Terminal, Code, Zap, Github, Globe, Cpu, ChevronRight, Command, Loader2, Sparkles, Database, Layout, Rocket, LogOut, User as UserIcon, AlertTriangle, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { generateBlueprint, Blueprint } from './services/gemini';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  serverTimestamp, 
  handleFirestoreError, 
  OperationType,
  FirebaseUser
} from './firebase';

const TYPE_SPEED = 30;

// Error Boundary Component
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0a0a] text-[#00d4ff] font-mono p-8 flex flex-col items-center justify-center">
          <div className="max-w-2xl w-full border border-red-500 p-8 bg-red-500/5">
            <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <AlertTriangle className="text-red-500" /> [FATAL_SYSTEM_ERROR]
            </h1>
            <div className="space-y-4 opacity-70 text-sm">
              <p>A critical exception has occurred in the core module.</p>
              <div className="bg-black p-4 border border-red-500/20 overflow-auto max-h-48">
                <code>{this.state.error?.message}</code>
              </div>
              <p>Attempting to recover system state...</p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-4 bg-red-500 text-white px-6 py-2 font-bold hover:bg-red-600 transition-all"
              >
                REBOOT_SYSTEM
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <DevBlueprintApp />
    </ErrorBoundary>
  );
}

function DevBlueprintApp() {
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [blueprint, setBlueprint] = useState<Blueprint & { id?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [recentBlueprints, setRecentBlueprints] = useState<any[]>([]);

  const fullText = "system.init_blueprint_generator()... [OK]\nloading_conversion_optimized_ui... [OK]\nawaiting_developer_input_";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
      if (user) {
        // Sync user to Firestore
        const userRef = doc(db, 'users', user.uid);
        setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: serverTimestamp()
        }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`));
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setText(fullText.slice(0, i));
      i++;
      if (i > fullText.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, TYPE_SPEED);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'blueprints'), orderBy('createdAt', 'desc'), limit(6));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const blueprints = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecentBlueprints(blueprints);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'blueprints'));
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error(err);
      setError("AUTH_FAILED. PLEASE_TRY_AGAIN.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    if (!user) {
      setError("AUTH_REQUIRED. PLEASE_CONNECT_GITHUB_OR_GOOGLE.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await generateBlueprint(prompt);
      
      // Save to Firestore
      const blueprintRef = doc(collection(db, 'blueprints'));
      const blueprintData = {
        ...result,
        userId: user.uid,
        authorName: user.displayName || 'Anonymous',
        createdAt: serverTimestamp()
      };
      await setDoc(blueprintRef, blueprintData);
      
      setBlueprint({ ...result, id: blueprintRef.id });
    } catch (err) {
      setError("FAILED_TO_GENERATE_OR_SAVE_BLUEPRINT.");
      handleFirestoreError(err, OperationType.WRITE, 'blueprints');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen crt relative">
      {/* Navigation */}
      <nav className="border-b border-[#00d4ff]/20 p-4 flex justify-between items-center bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-[#00d4ff] p-1 rounded-sm">
            <ShieldCheck className="w-6 h-6 text-black" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-black tracking-tighter glow-text text-lg">MAJOR_WEB_DEV</span>
            <span className="text-[8px] opacity-50 font-mono tracking-widest">SYSTEM_V2.0</span>
          </div>
        </div>
        <div className="hidden md:flex gap-8 text-sm opacity-70">
          <a href="#features" className="hover:text-[#00d4ff] transition-colors">FEATURES</a>
          <a href="#feed" className="hover:text-[#00d4ff] transition-colors">FEED</a>
          <a href="#docs" className="hover:text-[#00d4ff] transition-colors">DOCS</a>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="text-[10px] opacity-50 uppercase">User_Active</div>
                <div className="text-xs font-bold">{user.displayName}</div>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 border border-[#00d4ff]/20 hover:bg-[#00d4ff]/10 transition-all"
                title="LOGOUT"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="bg-[#00d4ff] text-black px-4 py-1 text-sm font-bold hover:bg-[#00d4ff]/80 transition-all flex items-center gap-2"
            >
              <UserIcon className="w-4 h-4" />
              CONNECT_AUTH
            </button>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 py-20">
        <AnimatePresence mode="wait">
          {!showGenerator ? (
            <motion.div 
              key="hero"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid lg:grid-cols-2 gap-12 items-center"
            >
              <div className="order-2 lg:order-1">
                <div className="inline-block border border-[#00d4ff]/30 px-3 py-1 text-[10px] mb-6 opacity-60">
                  STATUS: PRODUCTION_READY_2026
                </div>
                <h1 className="text-5xl md:text-7xl font-black leading-tight mb-6 tracking-tighter">
                  GENERATE <span className="text-white">CODE</span> <br />
                  NOT <span className="text-[#00d4ff]">FLUFF</span>.
                </h1>
                <p className="text-lg opacity-70 mb-8 max-w-lg leading-relaxed">
                  The high-converting blueprint generator for serious developers. 
                  Skip the boilerplate, focus on the logic. Built for performance, 
                  designed for utility.
                </p>
                <div className="flex flex-wrap gap-4">
                  <button 
                    onClick={() => setShowGenerator(true)}
                    className="bg-[#00d4ff] text-black px-8 py-4 font-bold text-lg hover:scale-105 transition-transform flex items-center gap-2"
                  >
                    START_GENERATING <ChevronRight className="w-5 h-5" />
                  </button>
                  <button className="border border-[#00d4ff] px-8 py-4 font-bold text-lg hover:bg-[#00d4ff]/10 transition-all">
                    VIEW_SAMPLES
                  </button>
                </div>
                
                <div className="mt-12 flex items-center gap-6 opacity-40 grayscale hover:grayscale-0 transition-all">
                  <div className="flex items-center gap-2"><Globe className="w-5 h-5" /> 10k+ DEVS</div>
                  <div className="flex items-center gap-2"><Zap className="w-5 h-5" /> 100ms LCP</div>
                  <div className="flex items-center gap-2"><Github className="w-5 h-5" /> 5k STARS</div>
                </div>
              </div>

              {/* Terminal Mockup */}
              <div className="order-1 lg:order-2">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="terminal-window rounded-lg overflow-hidden"
                >
                  <div className="bg-[#1a1a1a] p-3 flex items-center gap-2 border-b border-[#00d4ff]/20">
                    <div className="w-3 h-3 rounded-full bg-red-500/50" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                    <div className="w-3 h-3 rounded-full bg-green-500/50" />
                    <span className="text-[10px] opacity-40 ml-2">bash — dev_blueprint — 80x24</span>
                  </div>
                  <div className="p-6 h-[400px] font-mono text-sm overflow-y-auto">
                    <pre className="whitespace-pre-wrap">
                      {text}
                      {isTyping && <span className="cursor" />}
                    </pre>
                    {!isTyping && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-4"
                      >
                        <div className="text-white mb-2">$ npx create-blueprint --stack=react-firebase</div>
                        <div className="text-blue-400">? Project Name: <span className="text-white">my-awesome-app</span></div>
                        <div className="text-blue-400">? Auth Provider: <span className="text-white">GitHub</span></div>
                        <div className="text-blue-400">? UI Library: <span className="text-white">Tailwind CSS</span></div>
                        <div className="mt-4 text-[#00d4ff]">
                          [SUCCESS] Blueprint generated in 0.42s.
                          <br />
                          [INFO] View your blueprint at /blueprints/my-awesome-app
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="generator"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto"
            >
              <div className="terminal-window rounded-lg overflow-hidden mb-8">
                <div className="bg-[#1a1a1a] p-4 border-b border-[#00d4ff]/20 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#00d4ff]" />
                    <span className="text-xs font-bold">BLUEPRINT_GENERATOR_V2.0</span>
                  </div>
                  <button 
                    onClick={() => setShowGenerator(false)}
                    className="text-[10px] opacity-50 hover:opacity-100 transition-opacity"
                  >
                    [CLOSE_X]
                  </button>
                </div>
                <div className="p-8">
                  <div className="mb-6">
                    <label className="block text-[10px] opacity-50 mb-2 uppercase tracking-widest">Input Project Requirements</label>
                    <textarea 
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="E.g., A real-time chat app with React, Firebase, and Tailwind CSS. Needs group chats and file uploads."
                      className="w-full bg-black border border-[#00d4ff]/30 p-4 text-sm focus:border-[#00d4ff] outline-none transition-colors h-32 resize-none"
                    />
                  </div>
                  <button 
                    onClick={handleGenerate}
                    disabled={loading || !prompt.trim()}
                    className="w-full bg-[#00d4ff] text-black py-4 font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#00d4ff]/80 transition-all"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        GENERATING_BLUEPRINT...
                      </>
                    ) : (
                      <>
                        <Command className="w-5 h-5" />
                        EXECUTE_GENERATION
                      </>
                    )}
                  </button>
                  {error && (
                    <div className="mt-4 text-red-500 text-xs font-mono border border-red-500/30 p-3 bg-red-500/5">
                      [ERROR] {error}
                    </div>
                  )}
                  {!user && !loading && (
                    <div className="mt-4 text-[#00d4ff] text-[10px] text-center opacity-50">
                      * AUTH_REQUIRED_TO_SAVE_BLUEPRINTS
                    </div>
                  )}
                </div>
              </div>

              {blueprint && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="terminal-window rounded-lg overflow-hidden"
                >
                  <div className="bg-[#1a1a1a] p-4 border-b border-[#00d4ff]/20 flex items-center gap-2">
                    <Layout className="w-4 h-4 text-[#00d4ff]" />
                    <span className="text-xs font-bold uppercase tracking-widest">{blueprint.title}</span>
                  </div>
                  <div className="p-8 space-y-10 max-h-[800px] overflow-y-auto">
                    <section>
                      <h3 className="text-[#00d4ff] text-sm font-bold mb-4 flex items-center gap-2">
                        <ChevronRight className="w-4 h-4" /> 01_DESCRIPTION
                      </h3>
                      <p className="opacity-70 text-sm leading-relaxed">{blueprint.description}</p>
                    </section>

                    <section>
                      <h3 className="text-[#00d4ff] text-sm font-bold mb-4 flex items-center gap-2">
                        <ChevronRight className="w-4 h-4" /> 02_TECH_STACK
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {blueprint.techStack.map((tech, i) => (
                          <span key={i} className="border border-[#00d4ff]/30 px-3 py-1 text-[10px] bg-[#00d4ff]/5">
                            {tech}
                          </span>
                        ))}
                      </div>
                    </section>

                    <section>
                      <h3 className="text-[#00d4ff] text-sm font-bold mb-4 flex items-center gap-2">
                        <ChevronRight className="w-4 h-4" /> 03_ER_DIAGRAM
                      </h3>
                      <div className="bg-black/50 border border-[#00d4ff]/10 p-4 rounded font-mono text-xs overflow-x-auto">
                        <Markdown>{blueprint.erDiagram}</Markdown>
                      </div>
                    </section>

                    <section>
                      <h3 className="text-[#00d4ff] text-sm font-bold mb-4 flex items-center gap-2">
                        <ChevronRight className="w-4 h-4" /> 04_CORE_FEATURES
                      </h3>
                      <ul className="space-y-2">
                        {blueprint.features.map((feature, i) => (
                          <li key={i} className="text-sm opacity-70 flex items-start gap-2">
                            <span className="text-[#00d4ff] mt-1">▪</span> {feature}
                          </li>
                        ))}
                      </ul>
                    </section>

                    <section>
                      <h3 className="text-[#00d4ff] text-sm font-bold mb-4 flex items-center gap-2">
                        <ChevronRight className="w-4 h-4" /> 05_IMPLEMENTATION_PLAN
                      </h3>
                      <div className="space-y-4">
                        {blueprint.implementationPlan.map((step, i) => (
                          <div key={i} className="flex gap-4">
                            <div className="text-[10px] opacity-30 font-bold mt-1">PHASE_{i+1}</div>
                            <div className="text-sm opacity-70">{step}</div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <div className="pt-8 border-t border-[#00d4ff]/10 flex justify-end">
                      <button className="bg-[#00d4ff] text-black px-6 py-2 text-sm font-bold flex items-center gap-2 hover:bg-[#00d4ff]/80 transition-all">
                        <Rocket className="w-4 h-4" /> EXPORT_BLUEPRINT
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Features Grid */}
      <section id="features" className="max-w-7xl mx-auto px-4 py-24 border-t border-[#00d4ff]/10">
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard 
            icon={<Cpu className="w-8 h-8" />}
            title="AI_ENGINE_V2"
            description="Powered by Gemini 1.5 Pro for precise, context-aware architectural blueprints."
          />
          <FeatureCard 
            icon={<Code className="w-8 h-8" />}
            title="CLEAN_CODE_FIRST"
            description="Zero marketing fluff. We generate actual code snippets, ER diagrams, and setup scripts."
          />
          <FeatureCard 
            icon={<Zap className="w-8 h-8" />}
            title="ULTRA_FAST_SSR"
            description="Built on a stack that prioritizes Core Web Vitals. Your blueprints load in milliseconds."
          />
        </div>
      </section>

      {/* Blueprint Feed */}
      <section id="feed" className="max-w-7xl mx-auto px-4 py-24 border-t border-[#00d4ff]/10">
        <div className="flex justify-between items-end mb-12">
          <div>
            <div className="text-[10px] text-[#00d4ff] mb-2 font-bold tracking-widest">LIVE_FEED</div>
            <h2 className="text-3xl font-black tracking-tighter">RECENT_BLUEPRINTS</h2>
          </div>
          <button className="text-xs opacity-50 hover:opacity-100 transition-opacity flex items-center gap-2">
            VIEW_ALL_HISTORY <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recentBlueprints.length > 0 ? (
            recentBlueprints.map((bp) => (
              <FeedCard 
                key={bp.id}
                title={bp.title}
                stack={bp.techStack}
                author={bp.authorName || 'Anonymous'}
                time={bp.createdAt?.toDate ? new Date(bp.createdAt.toDate()).toLocaleDateString() : 'Just now'}
              />
            ))
          ) : (
            <div className="col-span-full py-12 text-center opacity-30 text-sm font-mono italic">
              NO_BLUEPRINTS_FOUND_IN_DATABASE...
            </div>
          )}
        </div>
      </section>

      {/* Trust Signals */}
      <section className="bg-[#00d4ff]/5 py-16 border-y border-[#00d4ff]/10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-[10px] opacity-40 uppercase tracking-[0.3em]">Trusted by developers from</p>
          </div>
          <div className="flex flex-wrap justify-center gap-12 md:gap-24 opacity-30 grayscale hover:grayscale-0 transition-all duration-500">
            <div className="flex items-center gap-2 font-bold text-xl"><Github className="w-6 h-6" /> GITHUB</div>
            <div className="flex items-center gap-2 font-bold text-xl"><Globe className="w-6 h-6" /> GOOGLE</div>
            <div className="flex items-center gap-2 font-bold text-xl"><Cpu className="w-6 h-6" /> NVIDIA</div>
            <div className="flex items-center gap-2 font-bold text-xl"><Zap className="w-6 h-6" /> VERCEL</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#00d4ff]/10 py-12 text-center opacity-40 text-xs">
        <p>© 2026 MAJOR_WEB_DEV. ALL_RIGHTS_RESERVED. [TERMINAL_CORE_UI_ENABLED]</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: ReactNode, title: string, description: string }) {
  return (
    <div className="p-8 border border-[#00d4ff]/10 hover:border-[#00d4ff]/40 transition-all group">
      <div className="text-[#00d4ff] mb-4 group-hover:scale-110 transition-transform">{icon}</div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="opacity-60 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function FeedCard({ title, stack, author, time }: { title: string, stack: string[], author: string, time: string }) {
  return (
    <div className="p-6 border border-[#00d4ff]/10 hover:border-[#00d4ff]/30 transition-all bg-black/20">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <span className="text-[10px] opacity-30">{time}</span>
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        {stack.map((s, i) => (
          <span key={i} className="text-[9px] border border-[#00d4ff]/20 px-2 py-0.5 opacity-50">{s}</span>
        ))}
      </div>
      <div className="flex items-center gap-2 text-[10px] opacity-40">
        <div className="w-4 h-4 rounded-full bg-[#00d4ff]/20 border border-[#00d4ff]/30" />
        <span>by {author}</span>
      </div>
    </div>
  );
}
