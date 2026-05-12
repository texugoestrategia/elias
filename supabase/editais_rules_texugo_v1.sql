-- Regras de Editais (Texugo) — versão didática baseada nos blocos enviados
--
-- O que este SQL faz:
-- 1) Garante que existe o rule set "default"
-- 2) Cria a versão 2 (published) do "default" com as regras abaixo
-- 3) Arquiva versões anteriores do "default"
-- 4) Cria/atualiza capabilities operacionais mínimas (valores podem ser ajustados depois)
--
-- Observações importantes (ajustes necessários):
-- - O sistema hoje não tem status "ANÁLISE INCOMPLETA" / "GO CONDICIONADO" como enum.
--   Então os blocos de "dados mínimos" e "extração completa" foram mapeados como regras INFO
--   (resultam em APTO_COM_RESSALVAS quando falham). Se você quiser que isso vire REVISAO_HUMANA
--   automaticamente, eu ajusto o motor (código) para suportar um tipo "REVIEW".
-- - Alguns campos abaixo pressupõem que você (no cadastro) vai preencher/classificar estes dados em
--   public.edital_classifications.data:
--   orgao, data_sessao, tipo_licitacao, me_epp, contains_redes, contains_wifi, contains_firewall,
--   contains_cabeamento, total_itens_extraidos, quantidades_definidas, valor_estimado_total,
--   tipo_contratacao, valor_mensal_estimado, local_execucao, sla_exigido, marca_exclusiva,
--   permite_equivalente, multa_max_percent.
--
-- Como rodar:
-- Supabase → SQL Editor → New query → cole este arquivo → Run

begin;

-- Capabilities operacionais (você pode atualizar depois)
insert into public.company_capabilities (key, type, value, source)
values
  ('operacao.projetos_sp_ativos', 'number', to_jsonb(0), 'manual'),
  ('operacao.projetos_fora_sp_ativos', 'number', to_jsonb(0), 'manual'),
  ('operacao.demanda_multiequipe', 'boolean', to_jsonb(false), 'manual'),
  ('juridico.multa_max_aceitavel_percent', 'number', to_jsonb(10), 'manual')
on conflict (key) do nothing;

-- Garante rule set default
insert into public.edital_rule_sets (key, name, description)
values ('default', 'Padrão', 'Conjunto padrão de regras')
on conflict (key) do nothing;

do $$
declare
  rs_id uuid;
begin
  select id into rs_id from public.edital_rule_sets where key = 'default' limit 1;
  if rs_id is null then
    raise exception 'Não foi possível localizar/criar o rule_set default';
  end if;

  -- se já existir versão 2, só garante que está published
  if exists(select 1 from public.edital_rule_set_versions where rule_set_id = rs_id and version = 2) then
    update public.edital_rule_set_versions
      set status = case when version = 2 then 'published' else 'archived' end
    where rule_set_id = rs_id;
    return;
  end if;

  -- Arquiva versões existentes e cria v2 publicada
  update public.edital_rule_set_versions
    set status = 'archived'
  where rule_set_id = rs_id;

  insert into public.edital_rule_set_versions (rule_set_id, version, status, tree)
  values (
    rs_id,
    2,
    'published',
    jsonb_build_object(
      'rules',
      jsonb_build_array(
        -- BLOCO 0 — PRÉ-CONDIÇÃO (dados mínimos) -> INFO (se falhar, vira ressalva)
        jsonb_build_object(
          'type','rule',
          'id','info_dados_minimos',
          'title','Dados mínimos preenchidos',
          'ruleType','INFO',
          'group','Qualidade',
          'message','ANÁLISE INCOMPLETA: faltam dados mínimos (órgão / data da sessão / tipo de licitação).',
          'when', jsonb_build_object(
            'type','group','op','AND','children', jsonb_build_array(
              jsonb_build_object('type','condition','field','classification','key','orgao','operator','present'),
              jsonb_build_object('type','condition','field','classification','key','data_sessao','operator','present'),
              jsonb_build_object('type','condition','field','classification','key','tipo_licitacao','operator','present')
            )
          )
        ),

        -- BLOCO 1 — ELIMINAÇÃO IMEDIATA (ME/EPP exclusivo) -> KO
        jsonb_build_object(
          'type','rule',
          'id','ko_me_epp_exclusivo',
          'title','ME/EPP exclusivo',
          'ruleType','KO',
          'group','Elegibilidade',
          'message','NO GO: licitação exclusiva ME/EPP.',
          'when', jsonb_build_object(
            'type','condition','field','classification','key','me_epp','operator','neq','value','exclusivo'
          )
        ),

        -- BLOCO 2 — INTERESSE TÉCNICO MÍNIMO -> KO
        jsonb_build_object(
          'type','rule',
          'id','ko_core_tecnico',
          'title','Interesse técnico mínimo',
          'ruleType','KO',
          'group','Técnico',
          'message','NO GO: fora do core (sem redes/wifi/firewall/cabeamento).',
          'when', jsonb_build_object(
            'type','group','op','OR','children', jsonb_build_array(
              jsonb_build_object('type','condition','field','classification','key','contains_redes','operator','eq','value', true),
              jsonb_build_object('type','condition','field','classification','key','contains_wifi','operator','eq','value', true),
              jsonb_build_object('type','condition','field','classification','key','contains_firewall','operator','eq','value', true),
              jsonb_build_object('type','condition','field','classification','key','contains_cabeamento','operator','eq','value', true)
            )
          )
        ),

        -- BLOCO 3 — EXTRAÇÃO COMPLETA -> INFO
        jsonb_build_object(
          'type','rule',
          'id','info_extracao_completa',
          'title','Extração completa',
          'ruleType','INFO',
          'group','Qualidade',
          'message','ANÁLISE INCOMPLETA: itens/quantidades não extraídos completamente.',
          'when', jsonb_build_object(
            'type','group','op','AND','children', jsonb_build_array(
              jsonb_build_object('type','condition','field','classification','key','total_itens_extraidos','operator','gt','value', 0),
              jsonb_build_object('type','condition','field','classification','key','quantidades_definidas','operator','eq','value', true)
            )
          )
        ),

        -- BLOCO 4 — VIABILIDADE FINANCEIRA -> KO
        jsonb_build_object(
          'type','rule',
          'id','ko_viabilidade_financeira',
          'title','Viabilidade financeira',
          'ruleType','KO',
          'group','Financeiro',
          'message','NO GO: ticket inviável (abaixo do mínimo).',
          'when', jsonb_build_object(
            'type','group','op','AND','children', jsonb_build_array(
              jsonb_build_object('type','condition','field','classification','key','valor_estimado_total','operator','gte','value', 30000),
              jsonb_build_object(
                'type','group','op','OR','children', jsonb_build_array(
                  jsonb_build_object('type','condition','field','classification','key','tipo_contratacao','operator','neq','value','mensal'),
                  jsonb_build_object(
                    'type','group','op','AND','children', jsonb_build_array(
                      jsonb_build_object('type','condition','field','classification','key','tipo_contratacao','operator','eq','value','mensal'),
                      jsonb_build_object('type','condition','field','classification','key','valor_mensal_estimado','operator','gte','value', 5000)
                    )
                  )
                )
              )
            )
          )
        ),

        -- BLOCO 5 — LOCALIZAÇÃO x OPERAÇÃO -> KO
        jsonb_build_object(
          'type','rule',
          'id','ko_localizacao_operacao',
          'title','Localização x operação',
          'ruleType','KO',
          'group','Operacional',
          'message','NO GO: capacidade geográfica excedida.',
          'when', jsonb_build_object(
            'type','group','op','OR','children', jsonb_build_array(
              jsonb_build_object('type','condition','field','classification','key','local_execucao','operator','eq','value','SP'),
              jsonb_build_object(
                'type','group','op','AND','children', jsonb_build_array(
                  jsonb_build_object('type','condition','field','classification','key','local_execucao','operator','neq','value','SP'),
                  jsonb_build_object('type','condition','field','capability','key','operacao.projetos_fora_sp_ativos','operator','lt','value', 1)
                )
              )
            )
          )
        ),

        -- BLOCO 6 — SLA COMPATÍVEL -> KO
        jsonb_build_object(
          'type','rule',
          'id','ko_sla_compativel',
          'title','SLA compatível',
          'ruleType','KO',
          'group','Operacional',
          'message','NO GO: SLA incompatível.',
          'when', jsonb_build_object(
            'type','group','op','OR','children', jsonb_build_array(
              jsonb_build_object('type','condition','field','classification','key','sla_exigido','operator','eq','value','horario_comercial'),
              jsonb_build_object(
                'type','group','op','AND','children', jsonb_build_array(
                  jsonb_build_object('type','condition','field','classification','key','local_execucao','operator','eq','value','SP'),
                  jsonb_build_object('type','condition','field','classification','key','sla_exigido','operator','in','value', jsonb_build_array('4h','8h'))
                )
              )
            )
          )
        ),

        -- BLOCO 7 — CAPACIDADE OPERACIONAL -> KO
        jsonb_build_object(
          'type','rule',
          'id','ko_capacidade_operacional',
          'title','Capacidade operacional',
          'ruleType','KO',
          'group','Operacional',
          'message','NO GO: operação saturada.',
          'when', jsonb_build_object(
            'type','group','op','AND','children', jsonb_build_array(
              jsonb_build_object('type','condition','field','capability','key','operacao.projetos_sp_ativos','operator','lt','value', 3),
              jsonb_build_object('type','condition','field','capability','key','operacao.demanda_multiequipe','operator','neq','value', true)
            )
          )
        ),

        -- BLOCO 8 — RISCO JURÍDICO CRÍTICO -> INFO (se falhar vira GO COM RESSALVAS)
        jsonb_build_object(
          'type','rule',
          'id','info_risco_juridico',
          'title','Risco jurídico crítico',
          'ruleType','INFO',
          'group','Jurídico',
          'message','GO COM RESSALVAS: risco jurídico exige ação (análise/impugnação/esclarecimento).',
          'when', jsonb_build_object(
            'type','group','op','AND','children', jsonb_build_array(
              jsonb_build_object(
                'type','group','op','OR','children', jsonb_build_array(
                  jsonb_build_object('type','condition','field','classification','key','marca_exclusiva','operator','eq','value', false),
                  jsonb_build_object('type','condition','field','classification','key','permite_equivalente','operator','eq','value', true)
                )
              ),
              jsonb_build_object('type','condition','field','classification','key','multa_max_percent','operator','lte','value', 10)
            )
          )
        )
      )
    )
  );
end $$;

commit;

