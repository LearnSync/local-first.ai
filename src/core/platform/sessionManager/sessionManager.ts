/**********************************************
 * This is the EntryPoint to the Session Manager This will manage all the Chat Session, Tab Session,so on..
 * To access other sessions manager you have to pass through this
 ***********************************************/

import { IApiConfig } from "@/core/types/appConfig";
import { EAiProvider } from "@/core/types/enum";
import { ChatService } from "../services";
import ChatSessionManager, { ChatSessionData } from "./chatSessionManager";
import TabSessionManager, { Tab } from "./tabSessionManager";

interface SessionManagerOptions {
  apiConfig: IApiConfig;
}

export interface INewSessionResponse {
  chat: ChatSessionData;
  tab: Tab;
}

export class SessionManager {
  private chatSessionManager: ChatSessionManager;
  private tabSessionManager: TabSessionManager;
  private chatService: ChatService;
  private apiConfig: IApiConfig;

  constructor({ apiConfig }: SessionManagerOptions) {
    this.chatSessionManager = ChatSessionManager.getInstance();
    this.tabSessionManager = TabSessionManager.getInstance();
    this.chatService = new ChatService(apiConfig);
    this.apiConfig = apiConfig;

    // Set up listener to close chat sessions when a tab closes
    this.tabSessionManager.onTabClose(this.removeTab.bind(this));
  }

  /**
   * Start a new chat session with a specific AI provider.
   * @param {string} tabId - Unique ID for the tab.
   * @param {EAiProvider} aiProvider - The AI provider for the chat.
   */
  public startChatSession(aiProvider: EAiProvider): INewSessionResponse | null {
    const label = `Chat with ${aiProvider}`;
    const tab = this.tabSessionManager.createTab(label);
    this.setActiveTab(tab.id);

    const chat = this.chatSessionManager.startNewChat(tab.id, aiProvider);

    if (!tab && !chat) return null;
    return { chat, tab };
  }

  // ----- Tabs
  /**
   * Retrieves the ID of the currently active tab.
   *
   * @returns {Tab | null} - The active tab, or `null` if no active tab exists.
   */

  public getTab(tabId: string): Tab | null {
    return this.tabSessionManager.getTab(tabId);
  }

  public getTabs(): Tab[] {
    return this.tabSessionManager.getTabs();
  }

  public getActiveTab(): Tab | null {
    return this.tabSessionManager.getActiveTab();
  }

  public setActiveTab(tabId: string): Tab | null {
    return this.tabSessionManager.setActiveTab(tabId);
  }

  public createTab(label: string): Tab {
    return this.tabSessionManager.createTab(label);
  }

  public updateTabLabel(tabId: string, label: string): void {
    this.tabSessionManager.updateTabLabel(tabId, label);
  }

  public unlockTab(tabId: string): Tab | null {
    return this.tabSessionManager.unlockTab(tabId);
  }

  public lockTab(tabId: string): Tab | null {
    return this.tabSessionManager.lockTab(tabId);
  }

  // ----- Sessions

  public getChatSession(id: string): ChatSessionData | undefined {
    return this.chatSessionManager.getChatSession(id);
  }

  /**
   * Handle closing a tab by closing its associated chat session.
   * @param {string} tabId - Unique ID of the tab to close.
   */
  public removeTab(tabId: string) {
    this.chatSessionManager.closeChat(tabId);
    this.tabSessionManager.removeTab(tabId);
  }

  /**
   * Close all chat and tab sessions.
   */
  public closeAllSessions() {
    this.chatSessionManager.setActiveChatSessions(false);
    this.tabSessionManager.closeAllTabs();
  }

  /**
   * Send a message to the LLM using `ChatService`.
   * @param {string} tabId - Unique ID for the tab/chat.
   * @param {string} message - Message to be sent to the LLM.
   * @param {Function} onText - Callback for text received in real-time.
   * @param {Function} onFinalMessage - Callback when the final response is ready.
   * @param {Function} onError - Callback when an error occurs.
   */
  public async sendMessageToLLM({
    tabId,
    message,
    onText,
    onFinalMessage,
    onError,
  }: {
    tabId: string;
    message: string;
    onText: (newText: string, fullText: string) => void;
    onFinalMessage: (fullText: string) => void;
    onError: (error: any) => void;
  }) {
    const chatSession = this.chatSessionManager.getChatSession(tabId);
    if (!chatSession) throw new Error("Chat session not found!!!");

    this.chatSessionManager.addChatMessage(tabId, message, "user");

    const { abort } = this.chatService.sendMessage({
      messages: chatSession.messages,
      apiConfig: this.apiConfig,
      onText: (newText: string, fullText: string) => {
        onText(newText, fullText);
      },
      onFinalMessage: (fullText: string) => {
        onFinalMessage(fullText);
        this.chatSessionManager.addChatMessage(tabId, fullText, "assistant");
      },
      onError: (error: any) => {
        console.error("Error in chat:", error);
        onError(error);
        this.chatSessionManager.addChatMessage(
          tabId,
          "An error occurred. Please try again."
        );
      },
    });

    this.chatSessionManager.setAbortFunction(tabId, abort);
  }
}

export default SessionManager;
