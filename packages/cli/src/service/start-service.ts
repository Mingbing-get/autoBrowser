export async function startService(): Promise<void> {
  const { createAutoBrowserService, createBridgeServer, createHttpApiServer } =
    await import("@autobrowser/service");
  const service = createAutoBrowserService();
  const httpServer = createHttpApiServer(service);
  const bridgeServer = createBridgeServer(service);
  await httpServer.listen();
  await bridgeServer.listen();
}
