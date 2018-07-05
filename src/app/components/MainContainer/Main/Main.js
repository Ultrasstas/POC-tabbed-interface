import React from 'react';
import { Grid } from 'semantic-ui-react';
import AccordionList from '../../AccordionList/AccordionList';
import TabList from '../../TabList/TabList';

import './Main.scss';

export default function Main(props) {
  return (
    <div style={{ margin: '0 2vh' }}>
      <Grid>
        <Grid.Column className="full-height" width={4}>
          <AccordionList onClickItem={props.onClickListItem} />
        </Grid.Column>
        <Grid.Column className="full-height" width={12}>
          <TabList onDeleteItem={props.onDeleteItem} />
        </Grid.Column>
      </Grid>
    </div>
  );
}