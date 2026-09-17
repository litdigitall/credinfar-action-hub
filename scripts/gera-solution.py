# -*- coding: utf-8 -*-
"""Gera a solution CFSCredinfarHub (publisher cfscredinfar, prefixo cdf).

Nesta fase o protótipo não tem tabelas: a solution existe para dar identidade
própria ao projeto (regra: cada projeto com solution e prefixo próprios) e para
levar o Code App (adicionado com pac solution add-solution-component
--componentType 300 depois do primeiro pac code push).

Uso: python scripts/gera-solution.py
     pac solution import --environment <url> --path scripts/CFSCredinfarHub.zip --publish-changes
"""
import io
import os
import zipfile

LANG = 1046  # pt-BR
VERSAO = "1.0.0.0"
UNIQUE = "CFSCredinfarHub"
PUBLISHER = "cfscredinfar"
PREFIX = "cdf"

solution = f"""<ImportExportXml version="9.2.25064.202" SolutionPackageVersion="9.2" languagecode="{LANG}" generatedBy="CrmLive" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <SolutionManifest>
    <UniqueName>{UNIQUE}</UniqueName>
    <LocalizedNames>
      <LocalizedName description="Credinfar Action Hub" languagecode="{LANG}" />
    </LocalizedNames>
    <Descriptions>
      <Description description="Hub operacional de crédito e cobrança Abbott x Credinfar: remessas, Central de Ações, INFASSOC.SIC e consulta da API Credinfar. By CFS Navigator" languagecode="{LANG}" />
    </Descriptions>
    <Version>{VERSAO}</Version>
    <Managed>0</Managed>
    <Publisher>
      <UniqueName>{PUBLISHER}</UniqueName>
      <LocalizedNames>
        <LocalizedName description="CFS Navigator · Credinfar Action Hub" languagecode="{LANG}" />
      </LocalizedNames>
      <Descriptions />
      <EMailAddress xsi:nil="true"></EMailAddress>
      <SupportingWebsiteUrl xsi:nil="true"></SupportingWebsiteUrl>
      <CustomizationPrefix>{PREFIX}</CustomizationPrefix>
      <CustomizationOptionValuePrefix>58301</CustomizationOptionValuePrefix>
      <Addresses />
    </Publisher>
    <RootComponents />
    <MissingDependencies />
  </SolutionManifest>
</ImportExportXml>
"""

customizations = f"""<ImportExportXml xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Entities />
  <Roles />
  <Workflows />
  <FieldSecurityProfiles />
  <Templates />
  <EntityMaps />
  <EntityRelationships />
  <OrganizationSettings />
  <optionsets />
  <CustomControls />
  <EntityDataProviders />
  <Languages>
    <Language>{LANG}</Language>
  </Languages>
</ImportExportXml>
"""

content_types = (
    '<?xml version="1.0" encoding="utf-8"?>'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="xml" ContentType="text/xml" /></Types>'
)

if __name__ == "__main__":
    raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.makedirs(os.path.join(raiz, "scripts"), exist_ok=True)
    destino = os.path.join(raiz, "scripts", f"{UNIQUE}.zip")
    with zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("solution.xml", solution)
        z.writestr("customizations.xml", customizations)
        z.writestr("[Content_Types].xml", content_types)
    print("gerado:", destino)
    io.open(os.path.join(raiz, "deploy", "tabelas.txt"), "w", encoding="utf-8", newline="\n").write("")
