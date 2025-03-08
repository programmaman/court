import "../components/theme.css";
import "./app.css";
import log from "../../helpers/logger";
import React, { useState } from "react";
import loadable from "@loadable/component";
import styled from "styled-components/macro";
import { Col, Layout, Menu, Row, Spin } from "antd";
import { Helmet } from "react-helmet";
import { BrowserRouter, NavLink, Route, Switch, useParams } from "react-router-dom";
import { ReactComponent as Logo } from "../assets/images/kleros-logo-flat-light.svg";
import AccountStatus from "../components/account-status";
import Footer from "../components/footer";
import NotificationSettings from "../components/notification-settings";
import { ChainIdProvider } from "../hooks/use-chain-id";
import ChainChangeWatcher from "./chain-change-watcher";
import drizzle, { DrizzleProvider, Initializer, useDrizzle } from "./drizzle";
import ErrorBoundary from "../components/error-boundary";
import SwitchChainFallback from "../components/error-fallback/switch-chain";
import PropTypes from "prop-types";

export default function App() {
  log.debug("App component mounted.");

  const [isMenuClosed, setIsMenuClosed] = useState(true);

  // Toggle menu state
  const toggleMenu = () => {
    setIsMenuClosed((prev) => {
      log.debug(`Menu toggled: ${!prev ? "Closed" : "Opened"}`);
      return !prev;
    });
  };

  // Close menu when clicking outside
  const closeMenu = () => {
    if (!isMenuClosed) {
      log.debug("Menu closed.");
    }
    setIsMenuClosed(true);
  };

  return (
    <>
      <Helmet>
        <title>Kleros · Court</title>
        <link
          href="https://fonts.googleapis.com/css?family=Roboto:400,400i,500,500i,700,700i"
          rel="stylesheet"
        />
      </Helmet>
      <DrizzleProvider drizzle={drizzle}>
        <Initializer
          error={<C404 Web3 />}
          loadingContractsAndAccounts={<C404 Web3 />}
          loadingWeb3={<StyledSpin tip="Connecting to your Web3 provider." />}
        >
          <DrizzleChainIdProvider>
            <ChainChangeWatcher>
              <ErrorBoundary fallback={SwitchChainFallback}>
                <BrowserRouter>
                  <Layout>
                    <StyledLayoutSider
                      breakpoint="md"
                      collapsedWidth="0"
                      collapsed={isMenuClosed}
                      onClick={toggleMenu}
                    >
                      <Menu theme="dark">{MenuItems}</Menu>
                    </StyledLayoutSider>
                    <Layout>
                      <StyledLayoutHeader>
                        <Row>
                          <StyledLogoCol lg={4} md={4} sm={12} xs={0}>
                            <LogoNavLink to="/">
                              <Logo />
                            </LogoNavLink>
                          </StyledLogoCol>
                          <Col lg={14} md={12} xs={0} style={{ padding: "0 16px" }}>
                            <StyledMenu mode="horizontal" theme="dark">
                              {MenuItems}
                            </StyledMenu>
                          </Col>
                          <StyledTrayCol lg={6} md={8} sm={12} xs={24}>
                            <StyledTray>
                              <AccountStatus />
                              <NotificationSettings settings={settings} />
                            </StyledTray>
                          </StyledTrayCol>
                        </Row>
                      </StyledLayoutHeader>
                      <StyledLayoutContent>
                        <Switch>
                          <Route exact path="/" component={Home} />
                          <Route exact path="/courts" component={Courts} />
                          <Route exact path="/cases" component={Cases} />
                          <Route exact path="/cases/:ID" component={Case} />
                          <Route exact path="/tokens" component={Tokens} />
                          <Route exact path="/convert-pnk" component={ConvertPnk} />
                          <Route path="*" component={C404} />
                        </Switch>
                      </StyledLayoutContent>
                      <Footer />
                      <StyledClickaway
                        isMenuClosed={isMenuClosed}
                        onClick={!isMenuClosed ? closeMenu : null}
                      />
                    </Layout>
                  </Layout>
                </BrowserRouter>
              </ErrorBoundary>
            </ChainChangeWatcher>
          </DrizzleChainIdProvider>
        </Initializer>
      </DrizzleProvider>
    </>
  );
}

// Drizzle Chain ID Provider
function DrizzleChainIdProvider({ children }) {
  log.debug("DrizzleChainIdProvider initialized."); // Log initialization

  const { drizzle } = useDrizzle();

  if (!drizzle.web3) {
    log.warn("DrizzleChainIdProvider: Web3 provider missing."); // Warn if Web3 is missing
    return <C404 />;
  }

  log.debug("DrizzleChainIdProvider: Web3 detected."); // Confirm Web3 is available
  return <ChainIdProvider web3={drizzle.web3}>{children}</ChainIdProvider>;
}

DrizzleChainIdProvider.propTypes = {
  children: PropTypes.node,
};

// Styled Components
const StyledSpin = styled(Spin)`
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
`;

// Lazy Loading for 404 Page
const C404 = loadable(() => {
  log.debug("Loading 404 (Not Found) page...");
  return import(/* webpackPrefetch: true */ "../containers/404");
}, { fallback: <StyledSpin /> });

// Lazy Loading for Home Page
const Home = loadable(() => {
  log.debug("Loading Home page...");
  return import(/* webpackPrefetch: true */ "../containers/home");
}, { fallback: <StyledSpin /> });

// Lazy Loading for Courts Page
const Courts = loadable(() => {
  log.debug("Loading Courts page...");
  return import(/* webpackPrefetch: true */ "../containers/courts");
}, { fallback: <StyledSpin /> });

// Lazy Loading for Cases Page
const Cases = loadable(() => {
  log.debug("Loading Cases page...");
  return import(/* webpackPrefetch: true */ "../containers/cases");
}, { fallback: <StyledSpin /> });

// Lazy Loading for Tokens Page
const Tokens = loadable(() => {
  log.debug("Loading Tokens page...");
  return import(/* webpackPrefetch: true */ "../containers/tokens");
}, { fallback: <StyledSpin /> });

// Lazy Loading for Convert PNK Page
const ConvertPnk = loadable(() => {
  log.debug("Loading Convert PNK page...");
  return import(/* webpackPrefetch: true */ "../containers/convert-pnk");
}, { fallback: <StyledSpin /> });

// Lazy Loading for Case Component with Validation
const CasePage = loadable(
  async ({ ID }) => {
    log.debug(`Loading Case page for ID: ${ID}...`);
    try {
      await drizzle.contracts.KlerosLiquid.methods.disputes(ID).call();
      log.debug(`Successfully loaded Case page for ID: ${ID}`);
      return import(/* webpackPrefetch: true */ "../containers/case");
    } catch (err) {
      log.error(`Error loading Case page for ID: ${ID} - ${err.message}`);
      return C404;
    }
  },
  { fallback: <StyledSpin /> }
);

// Component for Lazy Loading Case Page
const Case = () => {
  const { ID } = useParams();
  log.debug(`Rendering Case component for ID: ${ID}`);
  return <CasePage ID={ID} />;
};


// Menu Items
const MenuItems = [
  { key: "home", label: "Home", path: "/" },
  { key: "courts", label: "Courts", path: "/courts" },
  { key: "cases", label: "My Cases", path: "/cases" },
  {
    key: "guide",
    label: "Guide",
    path: "https://blog.kleros.io/become-a-juror-blockchain-dispute-resolution-on-ethereum/",
    external: true,
  },
].map(({ key, label, path, external }) =>
  external ? (
    <Menu.Item key={key}>
      <a href={path} target="_blank" rel="noopener noreferrer">
        {label}
      </a>
    </Menu.Item>
  ) : (
    <Menu.Item key={key}>
      <NavLink to={path}>{label}</NavLink>
    </Menu.Item>
  )
);

// Notification Settings
const settings = {
  draw: "When I am drawn as a juror.",
  appeal: "When a case I ruled is appealed.",
  key: "court",
  lose: "When I lose tokens.",
  win: "When I win arbitration fees.",
  stake: "When my stakes are changed.",
};

// Styled Layout Components
// Global Constants
const SIDEBAR_BG = "#4d00b4";
const HEADER_BG = "#4d00b4";
const CONTENT_BG = "#f2e3ff";
const MENU_ITEM_COLOR = "rgba(255, 255, 255, 0.85)";
const MENU_ITEM_HOVER = "rgba(255, 255, 255, 1)";

const StyledLayoutSider = styled(Layout.Sider)`
    position: fixed;
    height: 100%;
    z-index: 2000;
    background-color: ${SIDEBAR_BG};

    @media (min-width: 768px) {
        display: none;
    }

    .ant-layout-sider-zero-width-trigger {
        position: absolute;
        right: -50px;
        top: 12px;
        width: 50px;
        background-color: rgba(0, 0, 0, 0.2);
    }

    .ant-menu-dark {
        background: transparent;
    }
`;

const StyledLogoCol = styled(Col)`
    display: flex;
    align-items: center;
    height: 64px;
    padding-left: 1rem;

    @media (max-width: 769.98px) {
        padding-left: 1rem;
    }

    @media (max-width: 575px) {
        &.ant-col-xs-0 {
            display: none;
        }
    }
`;

const StyledTrayCol = styled(Col)`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    height: 64px;
`;

const StyledMenu = styled(Menu)`
    font-weight: 500;
    line-height: 64px !important;
    text-align: center;

    &.ant-menu-dark {
        background: transparent;
    }

    .ant-menu-item > a {
        color: ${MENU_ITEM_COLOR};
        transition: color 0.2s ease-in-out;

        &:hover,
        &:focus {
            color: ${MENU_ITEM_HOVER};
        }
    }

    .ant-menu-item-selected {
        background: transparent !important;

        > a {
            color: ${MENU_ITEM_HOVER};
        }
    }
`;

const StyledLayoutContent = styled(Layout.Content)`
  background: ${CONTENT_BG};
  min-height: calc(100vh - 64px);
  padding: 0 9.375vw 120px;
`;

const StyledLayoutHeader = styled(Layout.Header)`
  background-color: ${HEADER_BG};
  height: auto;
  line-height: normal;
`;

const StyledTray = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;

  > * {
    min-width: 0;
  }
`;

const StyledClickaway = styled.div`
  position: fixed;
  z-index: 1000;
  inset: 0; /* Equivalent to top: 0; right: 0; bottom: 0; left: 0 */
  background-color: black;
  opacity: ${({ isMenuClosed }) => (isMenuClosed ? 0 : 0.4)};
  pointer-events: ${({ isMenuClosed }) => (isMenuClosed ? "none" : "auto")};
  transition: opacity 0.3s ease-in-out;
`;

const LogoNavLink = styled(NavLink)`
  display: inline-block;
  max-width: 120px;

  > svg {
    display: block;
    width: 100%;
  }
`;
