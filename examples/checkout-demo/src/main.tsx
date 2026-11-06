import { createRoot } from "react-dom/client";
import { ClientProviders } from "../../../src/components/app/ClientProviders";
import App from "./App";

createRoot(document.getElementById("root")!).render(<ClientProviders><App /></ClientProviders>);
