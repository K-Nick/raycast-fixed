import {
  ActionPanel,
  Action,
  List,
  showToast,
  Toast,
  Detail,
  Icon,
  showHUD,
  popToRoot,
  Clipboard,
  Color,
  getPreferenceValues,
} from "@raycast/api";
import React, { useState, useEffect, useRef, useCallback } from "react";
import fetch, { AbortError } from "node-fetch";
import { get } from "http";
import { conferences_list, getConferenceAbbreviation } from "./constant";
import { Paper, Author, SearchState, Preference } from "./types";
import { ActionCopyBibTeX, ActionDownloadAndOpen } from "./action";
import { getMarkdownString } from "./markdown";
import { expandHomeDir } from "./utils";
import * as fs from "fs";
import * as path from "path";

let preference: Preference = getPreferenceValues();

export default function Command() {
  const { state, search } = useSearch();

  return (
    <List
      isLoading={state.isLoading}
      onSearchTextChange={search}
      searchBarPlaceholder="Search Papers"
      // isShowingDetail={state.results.length > 0}
      throttle={true}
    >
      <List.Section title="Results" subtitle={state.results.length + ""}>
        {state.results.map((paper) => (
          <SearchListItem
            key={paper.id}
            paper={paper}
            searchUrl={state.searchUrl}
            preference={preference}
          />
        ))}
      </List.Section>
    </List>
  );
}
function SearchListItem({
  paper,
  searchUrl,
  preference,
}: {
  paper: Paper;
  searchUrl: string;
  preference: Preference;
}) {
  // complete arxiv from DOI if possible
  if (paper.DOI && paper.DOI.includes("arXiv")) {
    let arxiv_id = paper.DOI.split("arXiv.")[1];
    paper.arxiv = arxiv_id;
  }

  let authorText =
    paper.authors && paper.authors.length > 1 ? paper.authors[0].name : "";
  if (paper.authors && paper.authors.length > 1) {
    authorText += ", et al.";
  }
  const conferences = conferences_list;
  let params = "";
  for (let i = 0; i < conferences.length; i++) {
    if (i > 0) {
      params += "&";
    }
    params +=
      encodeURIComponent(`venue[${i}]`) +
      "=" +
      encodeURIComponent(conferences[i]);
  }
  const accessories = [
    // { tag: { value: String(paper.venue), color: Color.Blue } },
    { tag: { value: String(paper.citationCount), color: Color.Yellow } },
    { tag: { value: String(paper.year), color: Color.Green } },
  ];
  console.log(paper.DOI);

  let markdown_string = getMarkdownString(paper);

  paper.markdown = markdown_string;
  paper.top_citation_url = paper.url + "?" + params;

  let bib_url = "https://dblp2.uni-trier.de/rec/" + paper.dblp + ".bib";
  let arxiv_pdf_url = `https://arxiv.org/pdf/${paper.arxiv}.pdf`;
  let paper_url = String(paper.arxiv ? arxiv_pdf_url : paper.DOI);
  let kimi_url = "https://papers.cool/arxiv/" + paper.arxiv;
  const pdfDir = expandHomeDir(preference.pdfDir);

  return (
    <List.Item
      title={paper.title}
      subtitle={authorText}
      // subtitle={"(" + String(paper.citationCount) + ") " + authorText}
      // subtitle={"(" + String(paper.citationCount) + ")"}
      // accessoryTitle={authorText}
      accessories={accessories}
      // detail={<List.Item.Detail markdown={PaperDetails(paper)} />}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action.Push
              title="Show Details"
              target={<PaperDetails paper={paper} />}
              icon={Icon.ArrowRight}
            />
            {/* <Action.OpenInBrowser
              title="Open Paper in Browser"
              url={paper_url}
            /> */}
            <ActionDownloadAndOpen url={paper_url} pdfDir={pdfDir} />
            <Action.OpenInBrowser
              title="Open Paper in Semantic Scholar"
              url={paper.url}
            />
            <Action.OpenInBrowser
              title="Open Paper in Kimi"
              url={kimi_url}
              shortcut={{ modifiers: ["shift", "cmd"], key: "enter" }}
            />
            <Action.CopyToClipboard
              title="Copy as Markdown"
              content={markdown_string}
              icon={Icon.Clipboard}
              shortcut={{ modifiers: ["shift", "cmd"], key: "c" }}
            />
            <Action.OpenInBrowser
              title="Open Search in Browser"
              url={searchUrl}
            />
            <Action.OpenInBrowser
              title="[Top Only] Open Search"
              url={searchUrl + "&" + params}
            />
            <Action.OpenInBrowser
              title="[Top Only] Open Paper"
              url={paper.url + "?" + params}
              shortcut={{ modifiers: ["shift", "cmd"], key: "enter" }}
            />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action.CopyToClipboard title="Copy Title" content={paper.title} />
            <Action.CopyToClipboard title="Copy URL" content={paper.url} />
            {paper.dblp && (
              <React.Fragment>
                {/* <Action.CopyToClipboard title="Copy DOI" content={paper.DOI} /> */}
                <ActionCopyBibTeX bib_url={bib_url} />
              </React.Fragment>
            )}
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

function PaperDetails({ paper }: { paper: Paper }) {
  // function PaperDetails(paper: Paper): string {
  let md = `## ${paper.title} (${paper.citationCount})\n`;
  if (paper.venue) {
    if (paper.venue.startsWith("arXiv")) {
      md += `**[${paper.arxiv}](https://arxiv.org/abs/${paper.arxiv})** `;
    } else {
      md += `**${paper.venue}** `;
    }
  }
  if (paper.publicationDate) {
    md += `(*${paper.publicationDate}*)\n\n`;
  } else {
    md += `(*${paper.year}*)\n\n`;
  }
  md += "---\n";
  // md += `**Publication Year**: ${paper.year}\n\n`;
  // md += `**Venue**: *${paper.venue}*\n`;
  // md += `### Authors\n`;
  md += `*${paper.authors?.map((a) => a.name).join(", ")}*\n\n`;

  // if (paper.arxiv) {
  //   md += "[Arxiv](https://arxiv.org/abs/" + paper.arxiv + ") ";
  // }
  // if (paper.DOI) {
  //   md += "[DOI](" + paper.DOI + ") ";
  // }
  // if (paper.arxiv || paper.DOI) {
  //   md += "\n\n";
  // }

  if (paper.tldr) {
    md += "`TL;DR` " + paper.tldr + "\n\n";
  }
  if (paper.abstract) {
    md += `~~~\n${paper.abstract}\n~~~\n`;
  }

  let bib_url = "https://dblp2.uni-trier.de/rec/" + paper.dblp + ".bib";

  // return md
  return (
    <Detail
      markdown={md}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action.OpenInBrowser title="Open in Browser" url={paper.url} />
            <Action.OpenInBrowser
              title="Open in Connect Papers"
              url={connectPapersURL(paper)}
            />
            {paper.dblp && (
              <React.Fragment>
                {/* <Action.CopyToClipboard title="Copy DOI" content={paper.dblp} /> */}
                <ActionCopyBibTeX bib_url={bib_url} />
              </React.Fragment>
            )}
            <Action.CopyToClipboard
              title="Copy as Markdown"
              content={String(paper.markdown)}
              icon={Icon.Clipboard}
              shortcut={{ modifiers: ["shift", "cmd"], key: "c" }}
            />
            <Action.OpenInBrowser
              title="[Top Only] Open Paper"
              url={String(paper.top_citation_url)}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

function useSearch() {
  const [state, setState] = useState<SearchState>({
    results: [],
    searchUrl: "",
    isLoading: true,
  });
  const cancelRef = useRef<AbortController | null>(null);

  const search = useCallback(
    async function search(searchText: string) {
      cancelRef.current?.abort();
      cancelRef.current = new AbortController();
      setState((oldState) => ({
        ...oldState,
        isLoading: true,
      }));
      try {
        const results = await performSearch(
          searchText,
          cancelRef.current.signal
        );
        setState((oldState) => ({
          ...oldState,
          results: results,
          searchUrl: constructSearchUrl(searchText),
          isLoading: false,
        }));
      } catch (error) {
        setState((oldState) => ({
          ...oldState,
          isLoading: false,
        }));

        if (error instanceof AbortError) {
          return;
        }

        console.error("search error", error);
        showToast({
          style: Toast.Style.Failure,
          title: "Could not perform search",
          message: String(error),
        });
      }
    },
    [cancelRef, setState]
  );

  useEffect(() => {
    search("");
    return () => {
      cancelRef.current?.abort();
    };
  }, []);

  return {
    state: state,
    search: search,
  };
}

function constructSearchUrl(searchText: string): string {
  const params = new URLSearchParams();
  params.append("q", searchText);
  params.append("sort", "relevance");
  return "https://www.semanticscholar.org/search" + "?" + params.toString();
}

function connectPapersURL(paper: Paper): string {
  return "https://www.connectedpapers.com/main/" + paper.id;
}

// Function to read the API key from a text file synchronously
function readApiKeySync(filePath: string): string {
  try {
    const data = fs.readFileSync(filePath, { encoding: "utf-8" });
    return data.trim(); // Using trim to remove any potential newline characters
  } catch (err) {
    console.error("Error reading the API key:", err);
    return ""; // Return empty string or handle the error as needed
  }
}

async function performSearch(
  searchText: string,
  signal: AbortSignal
): Promise<Paper[]> {
  if (!searchText) {
    return [];
  }

  const params = new URLSearchParams();
  params.append("query", searchText);
  params.append(
    "fields",
    "url,abstract,authors,url,title,citationCount,externalIds,venue,year,referenceCount,tldr,publicationDate"
  );
  params.append("limit", "50");
  params.append("sort", "relevance");

  // console.log(
  //   "https://api.semanticscholar.org/graph/v1/paper/search?" + params.toString()
  // );
  const api_key =
    readApiKeySync(path.join(String(process.env.HOME), "api_key_ss.txt")) || "";
  let headers = { "x-api-key": "" };
  if (api_key) {
    headers["x-api-key"] = String(api_key);
  }
  // console.log(headers);
  console.log(headers["x-api-key"]);
  console.log(
    "https://api.semanticscholar.org/graph/v1/paper/search?" + params.toString()
  );

  const response = await fetch(
    "https://api.semanticscholar.org/graph/v1/paper/search?" +
      params.toString(),
    {
      method: "get",
      signal: signal,
      headers: headers,
    }
  );
  const response_json = await response.json();

  const json = response_json as
    | {
        total: number;
        offset: number;
        data: {
          paperId: string;
          title: string;
          venue: string;
          year: number;
          publicationDate: string;
          referenceCount: number;
          citationCount: number;
          externalIds: {
            DOI?: string;
            ArXiv?: string;
            DBLP?: string;
          };
          url: string;
          abstract: string;
          authors: {
            authorId: string;
            name: string;
          }[];
          tldr: {
            model: string;
            text: string;
          };
        }[];
      }
    | { code: string; message: string };

  // console.log(response_json);
  // if response is empty, do not continue but do not throw error
  if ("total" in json && json["total"] == 0) {
    return [];
  }

  if (!response.ok || "message" in json) {
    throw new Error("message" in json ? json.message : response.statusText);
  }

  return json.data.map((paper) => {
    return {
      id: paper.paperId,
      title: paper.title,
      abstract: paper.abstract ? paper.abstract : "",
      authors: paper.authors,
      url: paper.url,
      venue: paper.venue ? paper.venue : "",
      year: paper.year,
      publicationDate: paper.publicationDate,
      referenceCount: paper.referenceCount,
      citationCount: paper.citationCount,
      DOI: paper.externalIds.DOI,
      tldr: paper.tldr ? paper.tldr.text : "",
      arxiv: paper.externalIds.ArXiv ? paper.externalIds.ArXiv : "",
      dblp: paper.externalIds.DBLP ? paper.externalIds.DBLP : "",
    };
  });
}
