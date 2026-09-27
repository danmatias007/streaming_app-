import { expect, test, type Page, type Route } from "@playwright/test";

const session = {
  accessToken: "e2e-access-token",
  expiresInSeconds: 900,
  user: { id:"u_e2e",email:"e2e@cinevault.test",name:"E2E",role:"USER",profiles:[{id:"p_e2e",name:"E2E",avatar:"🎬"}] }
};
const movies = [
  { id:"m_aurora",title:"Filme Aurora",thumbnail:"",kind:"MOVIE",synopsis:"Uma viagem cinematográfica pelo amanhecer.",releaseYear:2026,maturityRating:"12",durationMinutes:104,genres:["Drama"] },
  { id:"m_orbita",title:"Série Órbita",thumbnail:"",kind:"SERIES",synopsis:"Uma estação espacial recebe um sinal impossível.",releaseYear:2026,maturityRating:"14",durationMinutes:null,genres:["Ficção científica"] }
];

async function prepare(page:Page, authenticated=true) {
  let sessionActive=authenticated;
  const saved=new Set<string>();
  let detailsRequests=0;
  await page.addInitScript(() => localStorage.setItem("cinevault_locale","pt"));
  await page.route("**/api/v1/**", async route => {
    const request=route.request(); const url=new URL(request.url()); const path=url.pathname;
    if(path.endsWith("/auth/refresh")) return sessionActive?json(route,session):json(route,{error:{code:"INVALID_SESSION",message:"expired",requestId:"e2e"}},401);
    if(path.endsWith("/auth/login")){sessionActive=true;return json(route,session);}
    if(path.endsWith("/web/browse")) return json(route,{profile:session.user.profiles[0],billboard:{id:"m_aurora",title:"Filme Aurora",synopsis:movies[0]!.synopsis,videoPreviewUrl:""},rows:[{rowId:"row_e2e",title:"Seleção E2E",movies}]});
    if(path.endsWith("/web/watchlist")&&request.method()==="GET") return json(route,{items:[...saved]});
    if(path.includes("/web/watchlist/")&&request.method()==="PUT"){saved.add(decodeURIComponent(path.split("/").at(-1)!));return json(route,{saved:true});}
    if(path.includes("/web/watchlist/")&&request.method()==="DELETE"){saved.delete(decodeURIComponent(path.split("/").at(-1)!));return route.fulfill({status:204});}
    if(path.endsWith("/web/notifications")) return json(route,{items:[]});
    if(path.match(/\/web\/titles\/[^/]+\/reviews$/)) return json(route,{items:[]});
    if(path.match(/\/web\/titles\/[^/]+$/)){detailsRequests+=1;const id=decodeURIComponent(path.split("/").at(-1)!);const item=movies.find(value=>value.id===id)!;return json(route,{id:item.id,kind:item.kind,title:item.title,synopsis:item.synopsis,releaseYear:item.releaseYear,maturityRating:item.maturityRating,durationMinutes:item.durationMinutes,heroImageUrl:"",trailerUrl:"",genres:item.genres.map((name,index)=>({id:`g_${index}`,name,slug:name.toLowerCase().replaceAll(" ","-")})),seasons:[]});}
    return json(route,{error:{code:"NOT_MOCKED",message:path,requestId:"e2e"}},404);
  });
  return {saved,detailsRequests:()=>detailsRequests};
}

test("login conduz o assinante ao catálogo", async ({page}) => {
  await prepare(page,false);
  await page.goto("/");
  await page.getByLabel("Email").fill("e2e@cinevault.test");
  await page.getByLabel("Senha").fill("SenhaSegura123");
  await page.locator("form").getByRole("button",{name:"Entrar"}).click();
  await expect(page.getByRole("link",{name:"Filmes"})).toBeVisible({timeout:5_000});
  await expect(page.getByText("Filme Aurora").first()).toBeVisible();
});

test("navegação, filtros e busca exibem o catálogo correto", async ({page}) => {
  await prepare(page);
  await page.goto("/");
  await page.getByRole("link",{name:"Filmes"}).click();
  await expect(page).toHaveURL(/view=movies/);
  await expect(page.getByRole("heading",{name:"Filmes"})).toBeVisible();
  await expect(page.getByText("Filme Aurora")).toBeVisible();
  await expect(page.getByText("Série Órbita")).toHaveCount(0);
  await page.getByRole("link",{name:"Séries"}).click();
  await expect(page.getByText("Série Órbita")).toBeVisible();
  await page.getByRole("button",{name:"Títulos, pessoas, gêneros"}).click();
  await page.getByRole("textbox",{name:"Títulos, pessoas, gêneros"}).fill("aurora");
  await expect(page.getByText("Filme Aurora")).toBeVisible();
  await expect(page.getByText("Série Órbita")).toHaveCount(0);
});

test("Minha lista salva e remove um título pelo fluxo real da interface", async ({page}) => {
  const state=await prepare(page);
  await page.goto("/");
  await page.locator(".card").filter({hasText:"Filme Aurora"}).click();
  const dialog=page.getByRole("dialog");
  await dialog.getByRole("button",{name:"Minha lista"}).click();
  await expect.poll(()=>state.saved.has("m_aurora")).toBe(true);
  await dialog.getByRole("button",{name:"Fechar"}).click();
  await page.getByRole("link",{name:"Minha lista"}).click();
  await expect(page.getByText("Filme Aurora")).toBeVisible();
  await page.getByText("Filme Aurora").click();
  await page.getByRole("dialog").getByRole("button",{name:"Minha lista"}).click();
  await expect.poll(()=>state.saved.has("m_aurora")).toBe(false);
});

test("solicita o preview somente depois de cinco segundos de hover", async ({page,isMobile}) => {
  test.skip(isMobile, "Preview por hover existe somente em dispositivos com mouse.");
  const state=await prepare(page);
  const pausedAt=new Date(Date.now()+60_000);
  await page.clock.install({time:pausedAt});
  await page.clock.pauseAt(pausedAt);
  await page.goto("/");
  const card=page.locator(".card").filter({hasText:"Filme Aurora"}).first();
  await card.hover();
  await page.clock.fastForward(4_900);
  expect(state.detailsRequests()).toBe(0);
  await page.clock.fastForward(200);
  await expect.poll(state.detailsRequests).toBe(1);
});

function json(route:Route,body:unknown,status=200){return route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)});}
