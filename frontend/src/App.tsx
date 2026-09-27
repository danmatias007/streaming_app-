import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { BrowseResponse } from "@netflix/shared-types";
import { featured, shelves, type Shelf, type Title } from "./catalog";
import { addToWatchlist, getBrowse, getTitleDetails, getWatchlist, removeFromWatchlist } from "./api";
import { useAuth } from "./AuthContext";
import { LoginPage } from "./LoginPage";
import { RegistrationPage } from "./RegistrationPage";
import { AdminPage } from "./AdminPage";
import { TitleDetailsModal } from "./TitleDetailsModal";
import { ChevronIcon, CloseIcon, InfoIcon, PlayIcon, SearchIcon } from "./icons";
import { LanguageSelector, useI18n, type Locale } from "./I18nContext";
import { NotificationCenter } from "./NotificationCenter";
import { ProfilePage } from "./ProfilePage";
import { ProfileAvatar } from "./ProfileAvatar";
import { HoverPreview } from "./HoverPreview";

type CatalogView = "home" | "movies" | "series" | "list";

const viewCopy: Record<Locale, Record<CatalogView | "search" | "empty" | "emptySearch" | "saved" | "removed" | "saveError", string>> = {
  pt: { home:"Início",movies:"Filmes",series:"Séries",list:"Minha lista",search:"Resultados para",empty:"Ainda não há títulos nesta seção.",emptySearch:"Nenhum título corresponde à sua busca.",saved:"Adicionado à sua lista.",removed:"Removido da sua lista.",saveError:"Não foi possível atualizar sua lista." },
  es: { home:"Inicio",movies:"Películas",series:"Series",list:"Mi lista",search:"Resultados para",empty:"Todavía no hay títulos en esta sección.",emptySearch:"Ningún título coincide con tu búsqueda.",saved:"Añadido a tu lista.",removed:"Eliminado de tu lista.",saveError:"No se pudo actualizar tu lista." },
  en: { home:"Home",movies:"Movies",series:"Series",list:"My list",search:"Results for",empty:"There are no titles in this section yet.",emptySearch:"No titles match your search.",saved:"Added to your list.",removed:"Removed from your list.",saveError:"Your list could not be updated." }
};

function Header({ accessToken, isAdmin, avatar, view, query, onNavigate, onQuery, onLogout }: { accessToken:string; isAdmin:boolean; avatar:string; view:CatalogView; query:string; onNavigate:(view:CatalogView)=>void; onQuery:(value:string)=>void; onLogout:()=>void }) {
  const { t } = useI18n();
  const [solid, setSolid] = useState(false);
  const [searching, setSearching] = useState(Boolean(query));
  const [profileOpen, setProfileOpen] = useState(() => new URLSearchParams(window.location.search).has("checkout"));
  const [currentAvatar, setCurrentAvatar] = useState(avatar);
  const searchInput = useRef<HTMLInputElement>(null);

  useEffect(() => { const onScroll=()=>setSolid(window.scrollY>32); onScroll(); window.addEventListener("scroll",onScroll,{passive:true}); return()=>window.removeEventListener("scroll",onScroll); },[]);
  useEffect(() => { setCurrentAvatar(avatar); }, [avatar]);
  useEffect(() => { if(searching) window.setTimeout(()=>searchInput.current?.focus(),0); },[searching]);
  useEffect(() => { if (!profileOpen) return; const close=(event:KeyboardEvent)=>event.key==="Escape"&&setProfileOpen(false); document.body.classList.add("profile-panel-open"); window.addEventListener("keydown",close); return()=>{document.body.classList.remove("profile-panel-open");window.removeEventListener("keydown",close);}; },[profileOpen]);

  function navigate(event:MouseEvent<HTMLAnchorElement>,next:CatalogView){event.preventDefault();onQuery("");onNavigate(next);}
  function toggleSearch(){if(searching&&query)onQuery("");setSearching(value=>!value);}
  function navigation(className:string,includeAdmin=false){return <nav className={className} aria-label={className==="mobile-nav"?"Navegação móvel":"Navegação principal"}>{(["home","movies","series","list"] as const).map(item=><a key={item} className={!query&&view===item?"active":""} href={viewHref(item)} onClick={event=>navigate(event,item)}>{t(item==="home"?"nav.home":item==="movies"?"nav.movies":item==="series"?"nav.series":"nav.list")}</a>)}{includeAdmin&&isAdmin&&<a href="/admin">{t("nav.admin")}</a>}</nav>;}
  return <><header className={`header ${solid||view!=="home"||query ? "header--solid" : ""}`}>
    <a href="/" className="brand" aria-label="Cinevault, início" onClick={event=>navigate(event,"home")}><span>C</span>INEVAULT</a>
    {navigation("nav",true)}
    <div className="actions">
      <div className={`search ${searching ? "search--open" : ""}`}>
        <button aria-label={t("nav.search")} aria-expanded={searching} onClick={toggleSearch}>{searching?<CloseIcon/>:<SearchIcon/>}</button>
        <input ref={searchInput} aria-label={t("nav.search")} placeholder={t("nav.search")} value={query} onChange={event=>onQuery(event.target.value)} onKeyDown={event=>{if(event.key==="Escape"){onQuery("");setSearching(false);}}}/>
      </div>
      <LanguageSelector compact/><NotificationCenter accessToken={accessToken}/>
      <button className={`profile profile-trigger${profileOpen?" open":""}`} aria-label="Meu perfil" aria-expanded={profileOpen} onClick={()=>setProfileOpen(value=>!value)}><span><ProfileAvatar value={currentAvatar}/></span></button>
    </div>
  </header>{navigation("mobile-nav")}{profileOpen&&<div className="profile-overlay" onMouseDown={event=>event.currentTarget===event.target&&setProfileOpen(false)}><section className="profile-overlay-panel"><ProfilePage accessToken={accessToken} embedded onClose={()=>setProfileOpen(false)} onLogout={onLogout} onProfileChange={profile=>setCurrentAvatar(profile.avatar)}/></section></div>}</>;
}

function Hero({ title, onDetails }: { title:Title; onDetails:(title:Title)=>void }) {
  const { t }=useI18n(); const words=title.name.split(" ");
  return <section className="hero" id="inicio"><div className="hero__image" style={title.thumbnail?{backgroundImage:`url(${title.thumbnail})`}:undefined}/><div className="hero__shade"/><div className="hero__content">
    <div className="eyebrow"><span>V</span> {t("hero.feature")}</div><h1>{words.slice(0,2).join(" ")}<br/><em>{words.slice(2).join(" ")||t("hero.original")}</em></h1>
    <p className="hero__meta"><strong>{title.match}% {t("hero.relevant")}</strong><span>{title.year}</span><span className="rating">{title.maturity}</span><span>{title.duration}</span></p><p className="hero__synopsis">{title.synopsis}</p>
    <div className="hero__buttons"><button className="button button--light" onClick={()=>onDetails(title)}><PlayIcon/> {t("hero.watch")}</button><button className="button button--glass" onClick={()=>onDetails(title)}><InfoIcon/> {t("hero.more")}</button></div>
  </div><div className="hero__edge"><span>{title.maturity}</span></div><a className="scroll-cue" href="#catalogo"><span>{t("hero.explore")}</span><i/></a></section>;
}

function Card({ accessToken,item,index,onSelect,progress=false }: {accessToken:string;item:Title;index:number;onSelect:(item:Title)=>void;progress?:boolean}) {
  const style=item.thumbnail?({"--card-art":`url(${item.thumbnail})`} as CSSProperties):undefined;
  const hoverTimer=useRef<number|null>(null); const hoverCycle=useRef(0);
  const [previewPending,setPreviewPending]=useState(false); const [previewUrl,setPreviewUrl]=useState("");
  const stopPreview=useCallback(()=>{hoverCycle.current+=1;if(hoverTimer.current!==null){window.clearTimeout(hoverTimer.current);hoverTimer.current=null;}setPreviewPending(false);setPreviewUrl("");},[]);
  useEffect(()=>()=>{hoverCycle.current+=1;if(hoverTimer.current!==null)window.clearTimeout(hoverTimer.current);},[item.id]);
  function beginPreview(event:ReactPointerEvent<HTMLElement>){if(event.pointerType!=="mouse"||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;stopPreview();const cycle=hoverCycle.current;setPreviewPending(true);hoverTimer.current=window.setTimeout(()=>{hoverTimer.current=null;void getTitleDetails(accessToken,item.id).then(details=>{if(hoverCycle.current===cycle&&details.trailerUrl)setPreviewUrl(details.trailerUrl);}).catch(()=>undefined).finally(()=>{if(hoverCycle.current===cycle)setPreviewPending(false);});},5000);}
  function select(){stopPreview();onSelect(item);}
  return <article className={`card art-${item.art}${previewUrl?" card--previewing":""}${previewPending?" card--preview-pending":""}`} data-archive={item.id} data-kind={item.kind} style={style} tabIndex={0} onPointerEnter={beginPreview} onPointerLeave={stopPreview} onClick={select} onKeyDown={event=>(event.key==="Enter"||event.key===" ")&&select()}>
    {previewUrl&&<HoverPreview url={previewUrl} onFinished={stopPreview}/>}<div className="card__rank">{String(index+1).padStart(2,"0")}</div><div className="card__wash"/><div className="card__content"><p>{item.genres[0]}</p><h3>{item.name}</h3><div className="card__meta"><strong>{item.match}%</strong><span>{item.maturity}</span><span>{item.year}</span></div></div><button type="button" className="card__play" aria-label={`Assistir ${item.name}`}><PlayIcon/></button>{previewPending&&<div className="card-preview-delay" aria-hidden="true"><i/></div>}{progress&&<div className="progress"><i style={{width:`${32+index*11}%`}}/></div>}
  </article>;
}

function ShelfRow({ accessToken,shelf,onSelect,onViewAll }: {accessToken:string;shelf:Shelf;onSelect:(item:Title)=>void;onViewAll:(shelf:Shelf)=>void}) {
  const {t}=useI18n(); const title=shelf.id==="trending"?t("shelf.trending"):shelf.id==="continue"?t("shelf.continue"):shelf.id==="noir"?t("shelf.noir"):shelf.title;
  return <section className="shelf" id={shelf.id==="trending"?"catalogo":undefined}><div className="shelf__heading"><h2>{title}</h2><button onClick={()=>onViewAll({...shelf,title})}>{t("catalog.all")} <ChevronIcon/></button></div><div className="shelf__rail">{shelf.items.map((item,index)=><Card key={item.id} accessToken={accessToken} item={item} index={index} onSelect={onSelect} progress={shelf.id==="continue"}/>)}</div></section>;
}

function CatalogLibrary({ accessToken,title,items,empty,onSelect }: {accessToken:string;title:string;items:Title[];empty:string;onSelect:(item:Title)=>void}) {
  return <main className="library-page"><header className="library-heading"><p>CINEVAULT / CATÁLOGO</p><h1>{title}</h1><span>{items.length} {items.length===1?"título":"títulos"}</span></header>{items.length?<div className="library-grid">{items.map((item,index)=><Card key={item.id} accessToken={accessToken} item={item} index={index} onSelect={onSelect}/>)}</div>:<div className="library-empty"><SearchIcon/><h2>{empty}</h2><p>Explore o catálogo e abra um título para continuar.</p></div>}</main>;
}

export function App() {
  const auth=useAuth(); const {t,locale}=useI18n(); const copy=viewCopy[locale];
  const [selected,setSelected]=useState<Title|null>(null); const [browse,setBrowse]=useState<BrowseResponse|null>(null); const [catalogError,setCatalogError]=useState(false);
  const [view,setView]=useState<CatalogView>(readView); const [query,setQuery]=useState(""); const [collection,setCollection]=useState<{title:string;items:Title[]}|null>(null);
  const [watchlist,setWatchlist]=useState<Set<string>>(new Set()); const [notice,setNotice]=useState("");
  const registrationToken=new URLSearchParams(window.location.search).get("registration");

  useEffect(()=>{const change=()=>{setView(readView());setCollection(null);window.scrollTo({top:0});};window.addEventListener("popstate",change);return()=>window.removeEventListener("popstate",change);},[]);
  useEffect(()=>{if(!auth.accessToken){setBrowse(null);return;}setCatalogError(false);void getBrowse(auth.accessToken).then(setBrowse).catch(()=>setCatalogError(true));void getWatchlist(auth.accessToken).then(list=>setWatchlist(new Set(list.items))).catch(()=>setNotice(copy.saveError));},[auth.accessToken,copy.saveError]);
  useEffect(()=>{if(!notice)return;const timer=window.setTimeout(()=>setNotice(""),2600);return()=>window.clearTimeout(timer);},[notice]);

  const liveShelves=useMemo<Shelf[]>(()=>{if(!browse?.rows.length)return shelves;return browse.rows.map((row,rowIndex)=>({id:row.rowId,title:row.title,items:row.movies.map((movie,movieIndex)=>({id:movie.id,kind:movie.kind,name:movie.title,year:movie.releaseYear,maturity:movie.maturityRating,duration:formatDuration(movie.durationMinutes,movie.kind),match:Math.max(82,98-movieIndex*3),genres:movie.genres.length?movie.genres:[t("catalog.selection")],synopsis:movie.synopsis,art:["signal","district","night","horizon"][rowIndex%4]!,thumbnail:movie.thumbnail}))}));},[browse,t]);
  const allTitles=useMemo(()=>deduplicate(liveShelves.flatMap(shelf=>shelf.items)),[liveShelves]);
  const liveFeatured=useMemo<Title>(()=>{const found=allTitles.find(item=>item.id===browse?.billboard.id);return found?{...found,synopsis:browse?.billboard.synopsis||found.synopsis}:{...featured,...(browse?{id:browse.billboard.id,name:browse.billboard.title,synopsis:browse.billboard.synopsis}: {})};},[allTitles,browse]);
  const searchResults=useMemo(()=>{const needle=normalize(query);return needle?allTitles.filter(item=>normalize([item.name,item.synopsis,...item.genres].join(" ")).includes(needle)):[];},[allTitles,query]);

  function navigate(next:CatalogView){setView(next);setCollection(null);window.history.pushState({},"",viewHref(next));window.scrollTo({top:0,behavior:"smooth"});}
  async function toggleList(id:string){if(!auth.accessToken)return;const saved=watchlist.has(id);setWatchlist(current=>{const next=new Set(current);saved?next.delete(id):next.add(id);return next;});try{if(saved)await removeFromWatchlist(auth.accessToken,id);else await addToWatchlist(auth.accessToken,id);setNotice(saved?copy.removed:copy.saved);}catch{setWatchlist(current=>{const next=new Set(current);saved?next.add(id):next.delete(id);return next;});setNotice(copy.saveError);}}

  if(registrationToken)return <RegistrationPage token={registrationToken}/>;
  if(auth.loading)return <div className="app-loading"><span>C</span></div>;
  if(!auth.accessToken)return <LoginPage/>;
  const accessToken=auth.accessToken;
  if(window.location.pathname==="/profile")return <ProfilePage accessToken={accessToken} onLogout={()=>void auth.signOut()}/>;
  if(window.location.pathname==="/admin")return auth.user?.role==="ADMIN"?<AdminPage accessToken={accessToken} onLogout={()=>void auth.signOut()}/>:<main className="access-denied"><h1>Acesso restrito</h1><a href="/">Voltar ao catálogo</a></main>;

  const library=query?{title:`${copy.search} “${query.trim()}”`,items:searchResults,empty:copy.emptySearch}:collection?{...collection,empty:copy.empty}:view==="movies"?{title:copy.movies,items:allTitles.filter(item=>item.kind==="MOVIE"),empty:copy.empty}:view==="series"?{title:copy.series,items:allTitles.filter(item=>item.kind==="SERIES"),empty:copy.empty}:view==="list"?{title:copy.list,items:allTitles.filter(item=>watchlist.has(item.id)),empty:copy.empty}:null;
  return <><Header accessToken={accessToken} isAdmin={auth.user?.role==="ADMIN"} avatar={auth.user?.profiles[0]?.avatar??"🎬"} view={view} query={query} onNavigate={navigate} onQuery={setQuery} onLogout={()=>void auth.signOut()}/>
    {library?<CatalogLibrary accessToken={accessToken} {...library} onSelect={setSelected}/>:<main><Hero title={liveFeatured} onDetails={setSelected}/>{catalogError&&<div className="catalog-alert">{t("catalog.fallback")}</div>}<div className="catalog">{liveShelves.map(shelf=><ShelfRow key={shelf.id} accessToken={accessToken} shelf={shelf} onSelect={setSelected} onViewAll={value=>{setCollection({title:value.title,items:value.items});window.scrollTo({top:0,behavior:"smooth"});}}/>)}</div></main>}
    <footer><a className="brand brand--small" href="/" onClick={event=>{event.preventDefault();navigate("home");}}><span>C</span>INEVAULT</a><p>{t("footer.tagline")}</p><small>{t("footer.copyright")}</small></footer>
    {notice&&<div className="app-toast" role="status">{notice}</div>}{selected&&<TitleDetailsModal accessToken={accessToken} fallback={selected} inWatchlist={watchlist.has(selected.id)} onToggleWatchlist={()=>void toggleList(selected.id)} onClose={()=>setSelected(null)}/>}</>;
}

function viewHref(view:CatalogView){return view==="home"?"/":`/?view=${view}`;}
function readView():CatalogView{const value=new URLSearchParams(window.location.search).get("view");return value==="movies"||value==="series"||value==="list"?value:"home";}
function deduplicate(items:Title[]){return [...new Map(items.map(item=>[item.id,item])).values()];}
function normalize(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase().trim();}
function formatDuration(minutes:number|null,kind:Title["kind"]){if(!minutes)return kind==="SERIES"?"Série":"Filme";return `${Math.floor(minutes/60)}h ${String(minutes%60).padStart(2,"0")}min`;}
